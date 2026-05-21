import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import { hmacSha256Base64, timingSafeEqual } from "../lib/crypto";

/**
 * Middleware that verifies Shopify webhook HMAC signatures.
 *
 * Shopify sends a base64-encoded HMAC-SHA256 of the raw request body
 * in the `X-Shopify-Hmac-SHA256` header, using the app's client secret.
 *
 * IMPORTANT: This must run before any body-parsing middleware, because
 * the body stream can only be consumed once.
 */
export const verifyWebhook = createMiddleware<AppEnv>(async (c, next) => {
  const hmacHeader = c.req.header("X-Shopify-Hmac-SHA256");
  const topic = c.req.header("X-Shopify-Topic");
  const shopDomain = c.req.header("X-Shopify-Shop-Domain");

  if (!hmacHeader || !topic || !shopDomain) {
    return c.json({ error: "Missing required Shopify webhook headers" }, 401);
  }

  // Read the raw body as ArrayBuffer — must be done before any JSON parsing
  const rawBody = await c.req.raw.clone().arrayBuffer();

  // Compute HMAC-SHA256 base64 digest
  const computedHmac = await hmacSha256Base64(
    c.env.SHOPIFY_APP_SECRET,
    rawBody,
  );

  const isValid = await timingSafeEqual(computedHmac, hmacHeader);

  if (!isValid) {
    return c.json({ error: "Webhook HMAC verification failed" }, 401);
  }

  // Parse the body and set context variables for route handlers
  const bodyText = new TextDecoder().decode(rawBody);
  const payload = JSON.parse(bodyText);

  c.set("webhookTopic", topic);
  c.set("webhookShop", shopDomain);
  c.set("webhookPayload", payload);

  await next();
});
