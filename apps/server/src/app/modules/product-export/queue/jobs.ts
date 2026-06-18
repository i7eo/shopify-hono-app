import { registerQueueJob, type QueueJobContext } from "@/infra/queue";
import { registerSchedulerTask } from "@/infra/scheduler";
import { badGatewayError } from "@/shared/exceptions";
import {
  createProductExportBucket,
  createProductExportDatabase,
  createProductExportShopifyClient,
} from "../runtime";
import {
  completeProductExportBulkOperation,
  fetchProductExportBulkOperation,
  startProductExportBulkOperationForRecord,
} from "../service";
import { createDatabaseProductExportsStore } from "../stores/database";
import {
  countCsvRows,
  CSV_HEADER,
  isCloudflareRuntime,
  jsonlToCsv,
  parseProductExportJobPayload,
  PRODUCT_EXPORT_PART_STATUSES,
  PRODUCT_EXPORT_RETRYABLE_PART_STATUSES,
  PRODUCT_EXPORT_STATUSES,
  selectCompleteLines,
} from "../utils";
import {
  PRODUCT_EXPORT_CLOUDFLARE_FINALIZE_PART_THRESHOLD,
  PRODUCT_EXPORT_CSV_CONTENT_TYPE,
  PRODUCT_EXPORT_JSONL_CHUNK_BYTES,
  PRODUCT_EXPORT_JSONL_CHUNK_OVERLAP_BYTES,
  PRODUCT_EXPORT_MAX_PART_BYTES,
  PRODUCT_EXPORT_QUEUE_JOBS,
  PRODUCT_EXPORT_RECONCILE_CRON,
} from "./constants";
import {
  createProductExportQueueMessage,
  enqueueProductExportJobFromContext,
  enqueueProductExportJobsFromContext,
} from ".";
import type {
  ProductExportPartRecord,
  ProductExportRecord,
  ProductExportStore,
} from "../types";
import type { Bucket } from "@/infra/bucket";
import type { AppEnv } from "@/typings";
import type { Context } from "hono";

let registered = false;

/**
 * Registers every background entrypoint used by product exports.
 *
 * Example: importing the product-export module during app bootstrap registers
 * both queue jobs and the daily reconcile scheduler before consumers start.
 */
export function registerModuleProductExportJobs(): void {
  if (registered) return;
  registered = true;

  registerQueueJob({
    handler: startBulkJob,
    name: PRODUCT_EXPORT_QUEUE_JOBS.START_BULK,
  });
  registerQueueJob({
    handler: bulkFinishedJob,
    name: PRODUCT_EXPORT_QUEUE_JOBS.BULK_FINISHED,
  });
  registerQueueJob({
    handler: planPartsJob,
    name: PRODUCT_EXPORT_QUEUE_JOBS.PLAN_PARTS,
  });
  registerQueueJob({
    handler: processPartJob,
    name: PRODUCT_EXPORT_QUEUE_JOBS.PROCESS_PART,
  });
  registerQueueJob({
    handler: finalizeJob,
    name: PRODUCT_EXPORT_QUEUE_JOBS.FINALIZE,
  });
  registerQueueJob({
    handler: reconcileJob,
    name: PRODUCT_EXPORT_QUEUE_JOBS.RECONCILE,
  });
  registerSchedulerTask({
    cron: PRODUCT_EXPORT_RECONCILE_CRON,
    handler: async (context) => {
      const { createQueueProducer } = await import("@/infra/queue");
      const producer = await createQueueProducer(context.runtimeEnv, {
        queue: isCloudflareRuntime(context.runtimeEnv)
          ? (context.bindings?.[context.runtimeEnv.APP_QUEUE_BINDING ?? ""] as
              | Queue
              | undefined)
          : undefined,
      });

      await producer.enqueue(
        createProductExportQueueMessage(
          PRODUCT_EXPORT_QUEUE_JOBS.RECONCILE,
          {},
        ),
        {
          idempotencyKey: PRODUCT_EXPORT_QUEUE_JOBS.RECONCILE,
          maxAttempts: context.runtimeEnv.APP_QUEUE_CONSUMER_MAX_RETRIES,
        },
      );
    },
    name: PRODUCT_EXPORT_QUEUE_JOBS.RECONCILE,
  });
}

async function startBulkJob(
  payload: Record<string, unknown>,
  context: QueueJobContext,
): Promise<void> {
  const job = parseProductExportJobPayload(payload);
  const store = await createStore(context);
  const record = await store.findById({
    id: job.exportId,
    shopDomain: job.shopDomain,
  });

  if (!record || record.status !== PRODUCT_EXPORT_STATUSES.QUEUED) return;

  const database = await createProductExportDatabase(context);
  const client = await createProductExportShopifyClient(
    context.runtimeEnv,
    database,
    job.shopDomain,
  );
  await startProductExportBulkOperationForRecord({
    client,
    record,
    store,
  });
}

/**
 * Handles the post-webhook stage. The webhook may already have persisted the
 * result URL, but the job re-queries Shopify when the URL is still missing.
 */
async function bulkFinishedJob(
  payload: Record<string, unknown>,
  context: QueueJobContext,
): Promise<void> {
  const job = parseProductExportJobPayload(payload);
  const store = await createStore(context);
  const record = await store.findById({
    id: job.exportId,
    shopDomain: job.shopDomain,
  });

  if (!record?.shopifyBulkOperationId) return;

  if (!record.resultUrl) {
    const database = await createProductExportDatabase(context);
    const client = await createProductExportShopifyClient(
      context.runtimeEnv,
      database,
      job.shopDomain,
    );
    const operation = await fetchProductExportBulkOperation(
      client,
      record.shopifyBulkOperationId,
    );

    if (!operation) return;

    await updateBulkOperationResult(context, record, operation);
  }

  await enqueueProductExportJobFromContext(
    context,
    PRODUCT_EXPORT_QUEUE_JOBS.PLAN_PARTS,
    job,
  );
}

/**
 * Splits the Shopify JSONL result into idempotent byte-range parts.
 *
 * The unique database key `(exportId, seq)` makes repeated webhooks, cron
 * retries and duplicate queue messages safe.
 */
async function planPartsJob(
  payload: Record<string, unknown>,
  context: QueueJobContext,
): Promise<void> {
  const job = parseProductExportJobPayload(payload);
  const store = await createStore(context);
  const record = await store.findById({
    id: job.exportId,
    shopDomain: job.shopDomain,
  });

  if (!record?.resultUrl || !record.fileSize) return;

  const existingStats = await store.getPartStats(record.id);
  if (existingStats.total > 0) {
    await enqueuePendingParts(context, store, record);
    return;
  }

  const now = new Date();
  const parts = createPartRecords(record, now);
  await store.createParts(parts);
  await store.update({
    ...record,
    status: PRODUCT_EXPORT_STATUSES.GENERATING_CSV,
    updatedAt: new Date(),
  });
  await enqueueProductExportJobsFromContext(
    context,
    PRODUCT_EXPORT_QUEUE_JOBS.PROCESS_PART,
    parts.map((part) => ({
      exportId: record.id,
      seq: part.seq,
      shopDomain: record.shopDomain,
    })),
  );
}

/**
 * Processes one product export part.
 *
 * The database claim step is the idempotency gate: only `pending` or `failed`
 * parts can move to `processing`, so duplicate messages simply no-op.
 */
async function processPartJob(
  payload: Record<string, unknown>,
  context: QueueJobContext,
): Promise<void> {
  const job = parseProductExportJobPayload(payload);
  if (job.seq === undefined) return;

  const store = await createStore(context);
  const record = await store.findById({
    id: job.exportId,
    shopDomain: job.shopDomain,
  });
  const part = await store.claimPart({
    exportId: job.exportId,
    seq: job.seq,
  });

  if (!record?.resultUrl || !part) return;

  try {
    const bucket = await createProductExportBucket(context);
    const processed = await processPart(record, part, bucket);
    await store.markPartDone({
      bucketKey: processed.bucketKey,
      bucketProvider: processed.bucketProvider,
      byteSize: processed.byteSize,
      exportId: part.exportId,
      rowCount: processed.rowCount,
      seq: part.seq,
    });
  } catch (error) {
    await store.markPartFailed({
      errorCode: "PROCESS_PART_FAILED",
      errorMessage: error instanceof Error ? error.message : String(error),
      exportId: part.exportId,
      seq: part.seq,
    });
    throw error;
  }

  const stats = await store.getPartStats(record.id);
  if (stats.total > 0 && stats.done === stats.total) {
    await enqueueProductExportJobFromContext(
      context,
      PRODUCT_EXPORT_QUEUE_JOBS.FINALIZE,
      job,
    );
  }
}

/**
 * Assembles CSV parts into the final export file.
 *
 * Cloudflare can finalize small exports. Large exports are marked
 * `requires_node_finalize` so a Node runtime can complete the heavier assemble.
 */
async function finalizeJob(
  payload: Record<string, unknown>,
  context: QueueJobContext,
): Promise<void> {
  const job = parseProductExportJobPayload(payload);
  const store = await createStore(context);
  const record = await store.findById({
    id: job.exportId,
    shopDomain: job.shopDomain,
  });

  if (!record || record.status === PRODUCT_EXPORT_STATUSES.READY) return;

  const stats = await store.getPartStats(record.id);
  if (stats.total === 0 || stats.done !== stats.total) return;

  const parts = await store.listParts(record.id);
  if (
    isCloudflareRuntime(context.runtimeEnv) &&
    parts.length > PRODUCT_EXPORT_CLOUDFLARE_FINALIZE_PART_THRESHOLD
  ) {
    await store.update({
      ...record,
      status: PRODUCT_EXPORT_STATUSES.REQUIRES_NODE_FINALIZE,
      updatedAt: new Date(),
    });
    return;
  }

  const bucket = await createProductExportBucket(context);
  const finalObject = await finalizeParts(record, parts, bucket);
  await store.update({
    ...record,
    bucketKey: finalObject.bucketKey,
    bucketProvider: finalObject.bucketProvider,
    completedAt: new Date(),
    fileSize: finalObject.byteSize,
    status: PRODUCT_EXPORT_STATUSES.READY,
    updatedAt: new Date(),
  });
}

/**
 * Daily safety net for missed webhooks, failed parts and duplicate events.
 * Ready/canceled records are excluded by the store query, so successful exports
 * disappear from reconciliation naturally.
 */
async function reconcileJob(
  _payload: Record<string, unknown>,
  context: QueueJobContext,
): Promise<void> {
  const store = await createStore(context);
  const olderThan = new Date(Date.now() - 15 * 60 * 1000);
  const records = await store.listRecoverableExports({ olderThan });

  for (const record of records) {
    if (record.status === PRODUCT_EXPORT_STATUSES.QUEUED) {
      await enqueueProductExportJobFromContext(
        context,
        PRODUCT_EXPORT_QUEUE_JOBS.START_BULK,
        { exportId: record.id, shopDomain: record.shopDomain },
      );
      continue;
    }

    if (record.status === PRODUCT_EXPORT_STATUSES.BULK_OPERATION_RUNNING) {
      await enqueueProductExportJobFromContext(
        context,
        PRODUCT_EXPORT_QUEUE_JOBS.BULK_FINISHED,
        { exportId: record.id, shopDomain: record.shopDomain },
      );
      continue;
    }

    if (record.status === PRODUCT_EXPORT_STATUSES.BULK_OPERATION_COMPLETED) {
      await enqueueProductExportJobFromContext(
        context,
        PRODUCT_EXPORT_QUEUE_JOBS.PLAN_PARTS,
        { exportId: record.id, shopDomain: record.shopDomain },
      );
      continue;
    }

    const retryParts = await store.listPartsByStatus({
      exportId: record.id,
      statuses: [...PRODUCT_EXPORT_RETRYABLE_PART_STATUSES],
    });
    await enqueueProductExportJobsFromContext(
      context,
      PRODUCT_EXPORT_QUEUE_JOBS.PROCESS_PART,
      retryParts.map((part) => ({
        exportId: record.id,
        seq: part.seq,
        shopDomain: record.shopDomain,
      })),
    );

    const stats = await store.getPartStats(record.id);
    if (stats.total > 0 && stats.done === stats.total) {
      await enqueueProductExportJobFromContext(
        context,
        PRODUCT_EXPORT_QUEUE_JOBS.FINALIZE,
        { exportId: record.id, shopDomain: record.shopDomain },
      );
    }
  }
}

/**
 * Persists fresh BulkOperation metadata fetched by a queue worker.
 *
 * This intentionally reuses the service path used by the webhook so status
 * transitions stay consistent across webhook and cron compensation flows.
 */
async function updateBulkOperationResult(
  context: QueueJobContext,
  record: ProductExportRecord,
  operation: NonNullable<
    Awaited<ReturnType<typeof fetchProductExportBulkOperation>>
  >,
): Promise<void> {
  await completeProductExportBulkOperation(createServiceContext(context), {
    bulkOperationId: record.shopifyBulkOperationId!,
    completedAt: operation.completedAt,
    errorCode: operation.errorCode,
    fileSize: operation.fileSize,
    objectCount: operation.objectCount,
    partialDataUrl: operation.partialDataUrl,
    resultUrl: operation.resultUrl,
    shopDomain: record.shopDomain,
    status: operation.status,
  });
}

/**
 * Re-enqueues all retryable parts for an export.
 *
 * Example: when `plan-parts` is retried after parts already exist, it does not
 * recreate rows; it only schedules unfinished work.
 */
async function enqueuePendingParts(
  context: QueueJobContext,
  store: ProductExportStore,
  record: ProductExportRecord,
): Promise<void> {
  const retryParts = await store.listPartsByStatus({
    exportId: record.id,
    statuses: [...PRODUCT_EXPORT_RETRYABLE_PART_STATUSES],
  });

  await enqueueProductExportJobsFromContext(
    context,
    PRODUCT_EXPORT_QUEUE_JOBS.PROCESS_PART,
    retryParts.map((part) => ({
      exportId: record.id,
      seq: part.seq,
      shopDomain: record.shopDomain,
    })),
  );
}

/**
 * Creates a product-export store from the queue runtime context.
 */
async function createStore(
  context: QueueJobContext,
): Promise<ProductExportStore> {
  return createDatabaseProductExportsStore(
    await createProductExportDatabase(context),
  );
}

/**
 * Builds part rows from a Shopify result size.
 *
 * `rangeStart` may include overlap for parts after the first one, while `seq`
 * still defines the nominal chunk used to decide which complete JSONL lines
 * belong to this part.
 */
function createPartRecords(
  record: ProductExportRecord,
  now: Date,
): ProductExportPartRecord[] {
  const fileSize = record.fileSize ?? 0;
  const parts: ProductExportPartRecord[] = [];

  for (
    let start = 0, seq = 0;
    start < fileSize;
    start += PRODUCT_EXPORT_JSONL_CHUNK_BYTES, seq += 1
  ) {
    const rangeStart =
      seq === 0
        ? start
        : Math.max(0, start - PRODUCT_EXPORT_JSONL_CHUNK_OVERLAP_BYTES);
    const rangeEnd = Math.min(
      fileSize - 1,
      start + PRODUCT_EXPORT_JSONL_CHUNK_BYTES - 1,
    );

    parts.push({
      attempts: 0,
      bucketKey: null,
      bucketProvider: null,
      byteSize: null,
      completedAt: null,
      createdAt: now,
      errorCode: null,
      errorMessage: null,
      exportId: record.id,
      id: crypto.randomUUID(),
      lockedAt: null,
      rangeEnd,
      rangeStart,
      rowCount: null,
      seq,
      status: PRODUCT_EXPORT_PART_STATUSES.PENDING,
      updatedAt: now,
    });
  }

  return parts;
}

/**
 * Fetches one Range chunk, keeps only complete JSONL lines owned by the part,
 * converts those products to CSV rows, and stores the CSV part in the bucket.
 */
async function processPart(
  record: ProductExportRecord,
  part: ProductExportPartRecord,
  bucket: Bucket,
): Promise<{
  bucketKey: string;
  bucketProvider: string;
  byteSize: number;
  rowCount: number;
}> {
  const response = await fetch(record.resultUrl!, {
    headers: {
      Range: `bytes=${part.rangeStart}-${part.rangeEnd}`,
    },
  });

  if (!response.ok && response.status !== 206) {
    throw badGatewayError("Failed to fetch product export part", {
      details: {
        status: response.status,
        statusText: response.statusText,
        url: record.resultUrl,
      },
    });
  }

  const jsonl = await response.text();
  const csv = jsonlToCsv(selectCompleteLines(jsonl, part));
  const bytes = new TextEncoder().encode(csv);
  const key = `${record.shopDomain}/product-exports/${record.id}/parts/${part.seq}.csv`;
  const stored = await bucket.put({
    body: new Response(bytes).body!,
    contentType: PRODUCT_EXPORT_CSV_CONTENT_TYPE,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    key,
    maxBytes: PRODUCT_EXPORT_MAX_PART_BYTES,
    originalName: `${part.seq}.csv`,
    safeName: `${part.seq}.csv`,
    shopDomain: record.shopDomain,
  });

  return {
    bucketKey: stored.key,
    bucketProvider: stored.provider,
    byteSize: stored.byteSize,
    rowCount: countCsvRows(csv),
  };
}

/**
 * Concatenates CSV parts into a merchant-facing CSV file.
 *
 * The header is written once here; individual CSV parts contain data rows only.
 */
async function finalizeParts(
  record: ProductExportRecord,
  parts: ProductExportPartRecord[],
  bucket: Bucket,
): Promise<{
  bucketKey: string;
  bucketProvider: string;
  byteSize: number;
}> {
  const chunks: Uint8Array[] = [new TextEncoder().encode(CSV_HEADER)];
  for (const part of parts) {
    if (!part.bucketKey) continue;

    const object = await bucket.open({ key: part.bucketKey });
    chunks.push(new Uint8Array(await new Response(object.body).arrayBuffer()));
  }

  const body = new Blob(chunks).stream();
  const key = `${record.shopDomain}/product-exports/${record.id}/products.csv`;
  const stored = await bucket.put({
    body,
    contentType: PRODUCT_EXPORT_CSV_CONTENT_TYPE,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    key,
    maxBytes: Math.max(record.fileSize ?? 0, PRODUCT_EXPORT_MAX_PART_BYTES),
    originalName: "products.csv",
    safeName: "products.csv",
    shopDomain: record.shopDomain,
  });

  return {
    bucketKey: stored.key,
    bucketProvider: stored.provider,
    byteSize: stored.byteSize,
  };
}

/**
 * Adapts queue context to the minimal Hono Context shape required by service
 * helpers that still resolve runtime capabilities through context accessors.
 */
function createServiceContext(context: QueueJobContext): Context<AppEnv> {
  return {
    env: context.bindings ?? {},
    get(key: string) {
      if (key === "runtimeEnv") return context.runtimeEnv;
      if (key === "runtimeLogger") return context.logger;
      return;
    },
  } as unknown as Context<AppEnv>;
}
