import { DEFAULT_RUNTIMES } from "@shamt/app-env";
import {
  PRODUCT_EXPORT_PART_STATUS_VALUES,
  PRODUCT_EXPORT_STATUS_VALUES,
} from "@shamt/database/models/postgres";
import { internalServerError } from "@/shared/exceptions";
import { PRODUCT_EXPORT_JSONL_CHUNK_BYTES } from "./queue/constants";
import type { ProductExportJobPayload } from "./queue";
import type { ProductExportPartRecord, ProductExportStatus } from "./types";
import type { RuntimeConfig } from "@/infra/env";

export const PRODUCT_EXPORT_STATUSES = {
  BULK_OPERATION_COMPLETED: PRODUCT_EXPORT_STATUS_VALUES[2],
  BULK_OPERATION_RUNNING: PRODUCT_EXPORT_STATUS_VALUES[1],
  CANCELED: PRODUCT_EXPORT_STATUS_VALUES[7],
  FAILED: PRODUCT_EXPORT_STATUS_VALUES[6],
  GENERATING_CSV: PRODUCT_EXPORT_STATUS_VALUES[3],
  QUEUED: PRODUCT_EXPORT_STATUS_VALUES[0],
  READY: PRODUCT_EXPORT_STATUS_VALUES[4],
  REQUIRES_NODE_FINALIZE: PRODUCT_EXPORT_STATUS_VALUES[5],
} as const;

export const PRODUCT_EXPORT_PART_STATUSES = {
  DONE: PRODUCT_EXPORT_PART_STATUS_VALUES[2],
  FAILED: PRODUCT_EXPORT_PART_STATUS_VALUES[3],
  PENDING: PRODUCT_EXPORT_PART_STATUS_VALUES[0],
  PROCESSING: PRODUCT_EXPORT_PART_STATUS_VALUES[1],
} as const;

export const PRODUCT_EXPORT_RETRYABLE_PART_STATUSES = [
  PRODUCT_EXPORT_PART_STATUSES.PENDING,
  PRODUCT_EXPORT_PART_STATUSES.FAILED,
] as const;

export const CSV_HEADER =
  "id,title,handle,status,vendor,productType,createdAt,updatedAt\n";

/**
 * Checks runtime identity through app-env constants instead of hard-coded
 * strings. This keeps module code aligned with the shared runtime matrix.
 */
export function isCloudflareRuntime(
  config: Pick<RuntimeConfig, "APP_RUNTIME">,
) {
  return config.APP_RUNTIME === DEFAULT_RUNTIMES.CLOUDFLARE;
}

/**
 * Maps Shopify BulkOperation statuses into the product-export lifecycle.
 */
export function mapBulkOperationStatus(status: string): ProductExportStatus {
  switch (status.toUpperCase()) {
    case "COMPLETED":
      return PRODUCT_EXPORT_STATUSES.BULK_OPERATION_COMPLETED;
    case "CANCELED":
      return PRODUCT_EXPORT_STATUSES.CANCELED;
    case "FAILED":
    case "EXPIRED":
      return PRODUCT_EXPORT_STATUSES.FAILED;
    default:
      return PRODUCT_EXPORT_STATUSES.BULK_OPERATION_RUNNING;
  }
}

/**
 * Validates the minimal queue payload shared by all product-export jobs.
 *
 * Example: `{ exportId: "exp_1", shopDomain: "shop.myshopify.com", seq: 3 }`.
 */
export function parseProductExportJobPayload(
  payload: Record<string, unknown>,
): ProductExportJobPayload {
  if (
    typeof payload.exportId !== "string" ||
    typeof payload.shopDomain !== "string"
  ) {
    throw internalServerError("Invalid product export job payload", {
      details: {
        payload,
      },
      expose: true,
    });
  }

  return {
    exportId: payload.exportId,
    seq: typeof payload.seq === "number" ? payload.seq : undefined,
    shopDomain: payload.shopDomain,
  };
}

/**
 * Selects complete JSONL lines that belong to a part's nominal byte window.
 *
 * Range chunks after the first include overlap from the previous part. The
 * line-start byte position prevents duplicate CSV rows across overlapping
 * chunks.
 */
export function selectCompleteLines(
  jsonl: string,
  part: ProductExportPartRecord,
): string[] {
  const lines: string[] = [];
  let offset = part.rangeStart;
  let index = 0;

  while (index < jsonl.length) {
    const newlineIndex = jsonl.indexOf("\n", index);
    if (newlineIndex === -1) break;

    const lineStart = offset;
    const line = jsonl.slice(index, newlineIndex);
    const nominalStart = part.seq * PRODUCT_EXPORT_JSONL_CHUNK_BYTES;
    const nominalEnd = nominalStart + PRODUCT_EXPORT_JSONL_CHUNK_BYTES;

    if (
      line.length > 0 &&
      lineStart >= nominalStart &&
      lineStart < nominalEnd
    ) {
      lines.push(line);
    }

    offset += newlineIndex - index + 1;
    index = newlineIndex + 1;
  }

  return lines;
}

/**
 * Converts Shopify product JSONL lines to CSV rows without a header.
 */
export function jsonlToCsv(lines: string[]): string {
  return lines.map((line) => productToCsvLine(JSON.parse(line))).join("");
}

export type ProductExportCsvPartStreamResult = {
  body: ReadableStream<Uint8Array>;
  getRowCount: () => number;
};

/**
 * Streams Shopify JSONL bytes into CSV rows for one product-export part.
 *
 * The transform only buffers the current incomplete JSONL line. Completed rows
 * are emitted immediately, so large parts do not need `response.text()`.
 */
export function createProductExportCsvPartStream(
  jsonlStream: ReadableStream<Uint8Array>,
  part: ProductExportPartRecord,
): ProductExportCsvPartStreamResult {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = jsonlStream.getReader();
  let buffer = new Uint8Array(0);
  let offset = part.rangeStart;
  let rowCount = 0;

  return {
    body: new ReadableStream<Uint8Array>({
      async pull(controller) {
        while (true) {
          const newlineIndex = buffer.indexOf(10);
          if (newlineIndex !== -1) {
            const lineStart = offset;
            const lineBytes = buffer.subarray(0, newlineIndex);
            buffer = buffer.subarray(newlineIndex + 1);
            offset += newlineIndex + 1;
            const line = decoder.decode(lineBytes);

            if (isLineInPartWindow(line, lineStart, part)) {
              rowCount += 1;
              controller.enqueue(
                encoder.encode(productToCsvLine(JSON.parse(line))),
              );
              return;
            }

            continue;
          }

          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }

          buffer = concatBytes(buffer, value);
        }
      },
      async cancel(reason) {
        await reader.cancel(reason).catch(() => undefined);
      },
    }),
    getRowCount: () => rowCount,
  };
}

function concatBytes(
  left: Uint8Array<ArrayBufferLike>,
  right: Uint8Array<ArrayBufferLike>,
): Uint8Array<ArrayBuffer> {
  if (left.byteLength === 0) return new Uint8Array(right);
  const output = new Uint8Array(left.byteLength + right.byteLength);
  output.set(left);
  output.set(right, left.byteLength);
  return output;
}

export async function readProductExportCsvPartResult(
  result: ProductExportCsvPartStreamResult,
): Promise<{ body: ReadableStream<Uint8Array>; rowCount: number }> {
  const bytes = await new Response(result.body).arrayBuffer();

  return {
    body: new Response(bytes).body!,
    rowCount: result.getRowCount(),
  };
}

/**
 * Counts non-empty CSV rows in a part.
 */
export function countCsvRows(csv: string): number {
  return csv.length === 0 ? 0 : csv.split("\n").filter(Boolean).length;
}

function isLineInPartWindow(
  line: string,
  lineStart: number,
  part: ProductExportPartRecord,
): boolean {
  const nominalStart = part.seq * PRODUCT_EXPORT_JSONL_CHUNK_BYTES;
  const nominalEnd = nominalStart + PRODUCT_EXPORT_JSONL_CHUNK_BYTES;

  return line.length > 0 && lineStart >= nominalStart && lineStart < nominalEnd;
}

/**
 * Projects the product fields selected by the Bulk Operation query into one
 * CSV row.
 */
function productToCsvLine(value: unknown): string {
  const product = value as {
    createdAt?: unknown;
    handle?: unknown;
    id?: unknown;
    productType?: unknown;
    status?: unknown;
    title?: unknown;
    updatedAt?: unknown;
    vendor?: unknown;
  };

  // Built by direct concatenation (no intermediate array/map allocation) since
  // this runs once per exported product row.
  return `${csvCell(product.id)},${csvCell(product.title)},${csvCell(
    product.handle,
  )},${csvCell(product.status)},${csvCell(product.vendor)},${csvCell(
    product.productType,
  )},${csvCell(product.createdAt)},${csvCell(product.updatedAt)}\n`;
}

/**
 * Escapes one CSV cell according to RFC 4180 style double-quote escaping.
 * Cells without an embedded quote skip the replace pass entirely.
 */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return text.includes('"') ? `"${text.replaceAll('"', '""')}"` : `"${text}"`;
}
