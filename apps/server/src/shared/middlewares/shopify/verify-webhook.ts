import { deserializeValue } from "@shamt/utils";
import { createMiddleware } from "hono/factory";
import { getShopifyConfigProvider } from "@/infra/provider";
import { unauthorizedError } from "@/shared/exceptions";
import type { AppEnv } from "@/typings";

export const verifyWebhook = createMiddleware<AppEnv>(async (c, next) => {
  const rawBody = await c.req.raw.clone().text();
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
