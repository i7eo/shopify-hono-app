import { createMiddleware } from "hono/factory";
import { hmacSha256Base64, timingSafeEqual } from "../utils";
import type { AppEnv } from "../../../types";

export const verifyWebhook = createMiddleware<AppEnv>(async (c, next) => {
  const hmacHeader = c.req.header("X-Shopify-Hmac-SHA256");
  const topic = c.req.header("X-Shopify-Topic");
  const shopDomain = c.req.header("X-Shopify-Shop-Domain");

  if (!hmacHeader || !topic || !shopDomain) {
    return c.json({ error: "Missing required Shopify webhook headers" }, 401);
  }

  const rawBody = await c.req.raw.clone().arrayBuffer();
  const computedHmac = await hmacSha256Base64(
    c.env.SHOPIFY_APP_SECRET,
    rawBody,
  );

  const isValid = await timingSafeEqual(computedHmac, hmacHeader);

  if (!isValid) {
    return c.json({ error: "Webhook HMAC verification failed" }, 401);
  }

  const bodyText = new TextDecoder().decode(rawBody);
  const payload = JSON.parse(bodyText);

  c.set("webhookTopic", topic);
  c.set("webhookShop", shopDomain);
  c.set("webhookPayload", payload);

  await next();
});
