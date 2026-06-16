import { deserializeValue } from "@shamt/utils";
import { createMiddleware } from "hono/factory";
import { DEFAULT_WEBHOOK_MAX_SIZE } from "@/constants";
import { getShopifyConfigProvider } from "@/infra/provider";
import { payloadTooLargeError, unauthorizedError } from "@/shared/exceptions";
import type { AppEnv } from "@/typings";

/**
 * Validates Shopify webhook signatures and stores parsed webhook context.
 */
export const verifyWebhook = createMiddleware<AppEnv>(async (c, next) => {
  const rawBody = await readLimitedBody(c.req.raw, DEFAULT_WEBHOOK_MAX_SIZE);
  const config = c.get("runtimeEnv");
  const shopify = await getShopifyConfigProvider(config);
  const validation = await shopify.webhooks.validate({
    rawRequest: c.req.raw,
    rawBody,
  });

  if (!validation.valid) {
    throw unauthorizedError("Webhook validation failed", {
      details: { validation },
    });
  }

  const payload = deserializeValue(rawBody);
  if (payload === undefined) {
    throw unauthorizedError("Invalid Shopify webhook JSON payload");
  }

  c.set("webhookTopic", validation.topic);
  c.set("webhookShop", validation.domain);
  c.set("webhookPayload", payload);

  await next();
});

/**
 * Reads the raw body with a hard byte limit before JSON parsing.
 */
async function readLimitedBody(request: Request, maxSize: number) {
  const contentLength = readContentLength(
    request.headers.get("content-length"),
  );

  if (contentLength !== undefined && contentLength > maxSize) {
    throw createWebhookPayloadTooLargeError(maxSize);
  }

  const reader = request.clone().body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    bytes += value.byteLength;
    if (bytes > maxSize) {
      await reader.cancel().catch(() => undefined);
      throw createWebhookPayloadTooLargeError(maxSize);
    }

    chunks.push(decoder.decode(value, { stream: true }));
  }

  chunks.push(decoder.decode());

  return chunks.join("");
}

/**
 * Parses Content-Length only when it is a valid non-negative number.
 */
function readContentLength(value: string | null) {
  if (!value) return;

  const contentLength = Number(value);
  if (!Number.isFinite(contentLength) || contentLength < 0) return;

  return contentLength;
}

/**
 * Creates the shared payload-too-large error for Shopify webhook requests.
 */
function createWebhookPayloadTooLargeError(maxSize: number) {
  return payloadTooLargeError("Webhook request body overflow maxsize", {
    details: { maxSize },
  });
}
