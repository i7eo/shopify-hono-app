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
 * Parses optional Shopify timestamps without throwing on malformed payloads.
 */
export function parseNullableDate(value: string | null): Date | null {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Parses Shopify numeric fields that can arrive as strings or numbers.
 */
export function parseNullableNumber(
  value: string | number | null,
): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

/**
 * Counts non-empty CSV rows in a part.
 */
export function countCsvRows(csv: string): number {
  return csv.length === 0 ? 0 : csv.split("\n").filter(Boolean).length;
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

  return [
    product.id,
    product.title,
    product.handle,
    product.status,
    product.vendor,
    product.productType,
    product.createdAt,
    product.updatedAt,
  ]
    .map(csvCell)
    .join(",")
    .concat("\n");
}

/**
 * Escapes one CSV cell according to RFC 4180 style double-quote escaping.
 */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
