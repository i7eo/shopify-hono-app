import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PRODUCT_EXPORT_CLOUDFLARE_FINALIZE_PART_THRESHOLD,
  PRODUCT_EXPORT_QUEUE_JOBS,
} from "@/app/modules/product-export/queue/constants";
import {
  deleteProductExportPartObjects,
  registerModuleProductExportJobs,
} from "@/app/modules/product-export/queue/jobs";
import { createSqliteProductExportsRepository } from "@/app/modules/product-export/repositories/database/sqlite";
import { consumeQueueBatch } from "@/infra/queue/consumer";
import { resetQueueJobs } from "@/infra/queue/registry";
import { createMockRuntimeCapabilities } from "./shopify/test-utils";
import type { ProductExportRepository } from "@/app/modules/product-export/repositories/database";
import type {
  ProductExportPartRecord,
  ProductExportRecord,
} from "@/app/modules/product-export/types";
import type { Bucket } from "@/infra/bucket";
import type { Database } from "@/infra/database";
import type { QueueJobContext, QueueProducer } from "@/infra/queue";

describe("product export queue jobs", () => {
  const expectedReconcileConcurrency = 4;

  afterEach(() => {
    resetQueueJobs();
    vi.restoreAllMocks();
  });

  it("deletes intermediate part objects and skips parts without bucket keys", async () => {
    const bucket = createBucket();

    await deleteProductExportPartObjects(
      [
        createPartRecord({
          bucketKey: "shop/product-exports/2026/06/exp/0.csv",
        }),
        createPartRecord({ bucketKey: null, seq: 1 }),
        createPartRecord({
          bucketKey: "shop/product-exports/2026/06/exp/2.csv",
          seq: 2,
        }),
      ],
      bucket,
    );

    expect(bucket.delete).toHaveBeenCalledTimes(2);
    expect(bucket.delete).toHaveBeenNthCalledWith(1, {
      key: "shop/product-exports/2026/06/exp/0.csv",
    });
    expect(bucket.delete).toHaveBeenNthCalledWith(2, {
      key: "shop/product-exports/2026/06/exp/2.csv",
    });
  });

  it("reports part object delete failures after trying every part", async () => {
    const bucket = createBucket({
      delete: vi.fn(({ key }) =>
        key.endsWith("1.csv")
          ? Promise.reject(new Error("delete failed"))
          : Promise.resolve(),
      ),
    });

    await expect(
      deleteProductExportPartObjects(
        [
          createPartRecord({
            bucketKey: "shop/product-exports/2026/06/exp/0.csv",
          }),
          createPartRecord({
            bucketKey: "shop/product-exports/2026/06/exp/1.csv",
            seq: 1,
          }),
        ],
        bucket,
      ),
    ).rejects.toMatchObject({
      message: "Failed to delete product export part objects",
      status: 502,
    });
    expect(bucket.delete).toHaveBeenCalledTimes(2);
  });

  it("limits part object delete concurrency by batches", async () => {
    let activeDeletes = 0;
    let maxActiveDeletes = 0;
    const bucket = createBucket({
      delete: vi.fn(async () => {
        activeDeletes += 1;
        maxActiveDeletes = Math.max(maxActiveDeletes, activeDeletes);
        await new Promise((resolve) => setTimeout(resolve, 0));
        activeDeletes -= 1;
      }),
    });

    await deleteProductExportPartObjects(
      Array.from({ length: 25 }, (_, seq) =>
        createPartRecord({
          bucketKey: `shop/product-exports/2026/06/exp/${seq}.csv`,
          seq,
        }),
      ),
      bucket,
    );

    expect(bucket.delete).toHaveBeenCalledTimes(25);
    expect(maxActiveDeletes).toBeLessThanOrEqual(10);
  });

  it("fails Cloudflare finalize jobs over the part threshold without Node handoff", async () => {
    const update = vi.fn();
    const database = createDatabase(update);
    registerModuleProductExportJobs();

    const result = await consumeQueueBatch(
      {
        messages: [
          {
            attempts: 1,
            body: {
              name: PRODUCT_EXPORT_QUEUE_JOBS.FINALIZE,
              payload: {
                exportId: "export-1",
                shopDomain: "test-shop.myshopify.com",
              },
              version: 1,
            },
            id: "message-1",
          },
        ],
      },
      createCloudflareQueueContext({
        bucket: createBucket(),
        database,
      }),
    );

    expect(result.results[0]).toMatchObject({
      action: "retry",
      id: "message-1",
    });
    expect(result.results[0]).toMatchObject({
      error: {
        message:
          "Product export cannot be finalized in Cloudflare runtime because it exceeds the Cloudflare finalize part threshold and this environment cannot switch to Node.",
        status: 502,
      },
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "CLOUDFLARE_FINALIZE_UNSUPPORTED",
        errorMessage:
          "Product export cannot be finalized in Cloudflare runtime because it exceeds the Cloudflare finalize part threshold and this environment cannot switch to Node.",
        status: "failed",
      }),
    );
  });

  it("reconciles recoverable exports with bounded concurrency", async () => {
    vi.resetModules();
    const [{ consumeQueueBatch }, { registerModuleProductExportJobs }] =
      await Promise.all([
        import("@/infra/queue/consumer"),
        import("@/app/modules/product-export/queue/jobs"),
      ]);
    let activeEnqueues = 0;
    let maxActiveEnqueues = 0;
    let didListRecoverableExports = false;
    const producer: QueueProducer = {
      enqueue: vi.fn(async () => {
        activeEnqueues += 1;
        maxActiveEnqueues = Math.max(maxActiveEnqueues, activeEnqueues);
        await new Promise((resolve) => setTimeout(resolve, 0));
        activeEnqueues -= 1;
      }),
      enqueueBatch: vi.fn(),
    };
    const repository = {
      listRecoverableExports: vi.fn(() => {
        if (didListRecoverableExports) return Promise.resolve([]);
        didListRecoverableExports = true;
        return Promise.resolve(
          Array.from({ length: expectedReconcileConcurrency + 2 }, (_, index) =>
            createProductExportRecord({
              id: `export-${index}`,
              status: "queued",
            }),
          ),
        );
      }),
    } as unknown as ProductExportRepository;
    registerModuleProductExportJobs();

    const result = await consumeQueueBatch(
      {
        messages: [
          {
            attempts: 1,
            body: {
              name: PRODUCT_EXPORT_QUEUE_JOBS.RECONCILE,
              payload: {},
              version: 1,
            },
            id: "message-1",
          },
        ],
      },
      createReconcileQueueContext({
        producer,
        repository,
      }),
    );

    expect(result.results[0]).toMatchObject({
      action: "ack",
      id: "message-1",
    });
    expect(producer.enqueue).toHaveBeenCalledTimes(
      expectedReconcileConcurrency + 2,
    );
    expect(maxActiveEnqueues).toBeGreaterThan(1);
    expect(maxActiveEnqueues).toBeLessThanOrEqual(expectedReconcileConcurrency);
  });
});

function createBucket(overrides: Partial<Bucket> = {}): Bucket {
  return {
    delete: vi.fn(() => Promise.resolve()),
    open: vi.fn(),
    put: vi.fn(),
    ...overrides,
  };
}

function createCloudflareQueueContext(options: {
  bucket: Bucket;
  database: Database;
}): QueueJobContext {
  const runtimeEnv = {
    APP_QUEUE_CONSUMER_MAX_RETRIES: 3,
    APP_RUNTIME: "cloudflare",
  };
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  } as unknown as QueueJobContext["logger"];

  return {
    logger,
    runtimeCapabilities: createMockRuntimeCapabilities({
      database: () => options.database,
      databaseRepositories: {
        productExports: () =>
          createSqliteProductExportsRepository(options.database as never),
      },
      bucket: () => options.bucket,
    }),
    runtimeEnv,
  } as unknown as QueueJobContext;
}

function createReconcileQueueContext(options: {
  producer: QueueProducer;
  repository: ProductExportRepository;
}): QueueJobContext {
  const runtimeEnv = {
    APP_QUEUE_CONSUMER_MAX_RETRIES: 3,
    APP_RUNTIME: "node",
  };
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  } as unknown as QueueJobContext["logger"];

  return {
    logger,
    runtimeCapabilities: createMockRuntimeCapabilities({
      databaseRepositories: {
        productExports: () => options.repository,
      },
      queue: {
        producer: () => Promise.resolve(options.producer),
      },
    }),
    runtimeEnv,
  } as unknown as QueueJobContext;
}

function createDatabase(update: ReturnType<typeof vi.fn>): Database {
  return {
    db: {
      select(fields?: Record<string, unknown>) {
        if (fields) {
          return {
            from: () => ({
              where: () => ({
                groupBy: () =>
                  Promise.resolve([
                    {
                      status: "done",
                      total:
                        PRODUCT_EXPORT_CLOUDFLARE_FINALIZE_PART_THRESHOLD + 1,
                    },
                  ]),
              }),
            }),
          };
        }

        return {
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([createProductExportRecord()]),
            }),
          }),
        };
      },
      update: vi.fn(() => ({
        set: update.mockImplementation(() => ({
          where: () => Promise.resolve(),
        })),
      })),
    },
    provider: "d1",
  } as unknown as Database;
}

function createProductExportRecord(
  overrides: Partial<ProductExportRecord> = {},
): ProductExportRecord {
  const now = new Date("2026-06-20T00:00:00.000Z");

  return {
    bucketKey: null,
    bucketProvider: null,
    completedAt: null,
    createdAt: now,
    deletedAt: null,
    errorCode: null,
    errorMessage: null,
    fileSize: 1024,
    id: "export-1",
    name: "products",
    objectCount: null,
    partialDataUrl: null,
    resultUrl: "https://example.com/products.jsonl",
    shopDomain: "test-shop.myshopify.com",
    shopifyBulkOperationId: "gid://shopify/BulkOperation/1",
    shopifyBulkOperationStatus: "COMPLETED",
    shopifySessionId: "offline_test-shop.myshopify.com",
    status: "generating_csv",
    template: "basic",
    updatedAt: now,
    ...overrides,
  };
}

function createPartRecord(
  overrides: Partial<ProductExportPartRecord> = {},
): ProductExportPartRecord {
  const now = new Date("2026-06-20T00:00:00.000Z");

  return {
    attempts: 0,
    bucketKey: null,
    bucketProvider: null,
    byteSize: null,
    completedAt: null,
    createdAt: now,
    errorCode: null,
    errorMessage: null,
    exportId: "export-1",
    id: "part-1",
    lockedAt: null,
    rangeEnd: 1024,
    rangeStart: 0,
    rowCount: null,
    seq: 0,
    status: "done",
    updatedAt: now,
    ...overrides,
  };
}
