import { deserializeValue } from "@shamt/utils";
import { createMiddleware } from "hono/factory";
import { unauthorizedError } from "@/shared/exceptions";
import { hmacSha256Base64, timingSafeEqual } from "@/utils";
import type { AppEnv } from "@/types";

export const verifyWebhook = createMiddleware<AppEnv>(async (c, next) => {
  const hmacHeader = c.req.header("X-Shopify-Hmac-SHA256");
  const topic = c.req.header("X-Shopify-Topic");
  const shopDomain = c.req.header("X-Shopify-Shop-Domain");

  if (!hmacHeader || !topic || !shopDomain) {
    throw unauthorizedError("Missing required Shopify webhook headers");
  }

  const rawBody = await c.req.raw.clone().arrayBuffer();
  const computedHmac = await hmacSha256Base64(
    c.env.SHOPIFY_APP_SECRET,
    rawBody,
  );

  const isValid = await timingSafeEqual(computedHmac, hmacHeader);

  if (!isValid) {
    throw unauthorizedError("Webhook HMAC verification failed");
  }

  const bodyText = new TextDecoder().decode(rawBody);
  const payload = deserializeValue(bodyText);
  if (payload === undefined) {
    throw unauthorizedError("Invalid Shopify webhook JSON payload");
  }

  c.set("webhookTopic", topic);
  c.set("webhookShop", shopDomain);
  c.set("webhookPayload", payload);

  await next();
});
