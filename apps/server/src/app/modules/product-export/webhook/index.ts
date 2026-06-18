import { createResponse } from "@/shared/models";
import { enqueueProductExportJob } from "../queue";
import { PRODUCT_EXPORT_QUEUE_JOBS } from "../queue/constants";
import { completeProductExportBulkOperation } from "../service";
import type { AppEnv } from "@/typings";
import type { Context } from "hono";

type BulkOperationFinishWebhookPayload = {
  admin_graphql_api_id?: unknown;
  completed_at?: unknown;
  error_code?: unknown;
  file_size?: unknown;
  object_count?: unknown;
  partial_data_url?: unknown;
  status?: unknown;
  url?: unknown;
};

/**
 * Handles Shopify's bulk operation finish webhook.
 *
 * The webhook payload is small and only signals completion. Large JSONL data is
 * fetched later by queued Range jobs using the result URL.
 */
export async function handleProductExportBulkOperationFinishWebhook(
  c: Context<AppEnv>,
) {
  const payload = parseBulkOperationFinishWebhookPayload(c.var.webhookPayload);
  const logger = c.get("runtimeLogger");

  if (!payload) {
    logger.warn(
      `Ignored bulk operation finish webhook with invalid payload from ${c.var.webhookShop}`,
    );

    return c.json(
      createResponse({
        data: { ok: true },
        requestId: c.get("requestId"),
      }),
    );
  }

  const record = await completeProductExportBulkOperation(c, {
    bulkOperationId: payload.admin_graphql_api_id,
    completedAt: parseDate(payload.completed_at),
    errorCode: readNullableString(payload.error_code),
    fileSize: readNullableNumber(payload.file_size),
    objectCount: readNullableNumber(payload.object_count),
    partialDataUrl: readNullableString(payload.partial_data_url),
    resultUrl: readNullableString(payload.url),
    shopDomain: c.var.webhookShop,
    status: payload.status,
  });

  if (record) {
    await enqueueProductExportJob(c, PRODUCT_EXPORT_QUEUE_JOBS.BULK_FINISHED, {
      exportId: record.id,
      shopDomain: record.shopDomain,
    });
  } else {
    logger.info(
      `Ignored bulk operation finish webhook for unmanaged operation ${payload.admin_graphql_api_id}`,
    );
  }

  return c.json(
    createResponse({
      data: { ok: true },
      requestId: c.get("requestId"),
    }),
  );
}

/**
 * Validates the fields required to identify a Shopify BulkOperation.
 */
function parseBulkOperationFinishWebhookPayload(value: unknown):
  | ({
      admin_graphql_api_id: string;
      completed_at?: unknown;
      status: string;
    } & BulkOperationFinishWebhookPayload)
  | null {
  if (!value || typeof value !== "object") return null;

  const payload = value as BulkOperationFinishWebhookPayload;
  if (
    typeof payload.admin_graphql_api_id !== "string" ||
    typeof payload.status !== "string"
  ) {
    return null;
  }

  return {
    ...payload,
    admin_graphql_api_id: payload.admin_graphql_api_id,
    status: payload.status,
  };
}

/**
 * Parses Shopify webhook timestamps defensively.
 */
function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Reads nullable numeric webhook fields.
 */
function readNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.length === 0) return null;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

/**
 * Reads nullable string webhook fields.
 */
function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
