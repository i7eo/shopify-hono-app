import { Hono } from "hono";
import { handleProductExportBulkOperationFinishWebhook } from "@/app/modules/product-export/webhook";
import { verifyWebhook } from "@/shared/middlewares";
import { createResponse } from "@/shared/models";
import { getShopifySessionStorage } from "../session-storage";
import type { AppEnv } from "@/typings";

/**
 * Creates verified Shopify webhook routes and handlers.
 */
export const createWebhookRoutes = () => {
  const webhookRoutes = new Hono<AppEnv>();

  webhookRoutes.use("/*", verifyWebhook);

  webhookRoutes.post("/app/uninstalled", async (c) => {
    const shop = c.var.webhookShop;
    const sessionStorage = await getShopifySessionStorage(c);
    const sessions = await sessionStorage.findSessionsByShop(shop);
    await sessionStorage.deleteSessions(sessions.map((session) => session.id));
    const logger = c.get("runtimeLogger");
    logger.info(`App uninstalled: ${shop}`);
    return c.json(
      createResponse({ data: { ok: true }, requestId: c.get("requestId") }),
    );
  });

  webhookRoutes.post(
    "/bulk_operations/finish",
    handleProductExportBulkOperationFinishWebhook,
  );

  webhookRoutes.post("/customers/data-request", (c) => {
    const shop = c.var.webhookShop;
    const payload = c.var.webhookPayload;
    const logger = c.get("runtimeLogger");
    logger.info(
      `Customer data request from ${shop}: ${JSON.stringify(payload)}`,
    );
    return c.json(
      createResponse({ data: { ok: true }, requestId: c.get("requestId") }),
    );
  });

  webhookRoutes.post("/customers/redact", (c) => {
    const shop = c.var.webhookShop;
    const payload = c.var.webhookPayload;
    const logger = c.get("runtimeLogger");
    logger.info(
      `Customer redact request from ${shop}: ${JSON.stringify(payload)}`,
    );
    return c.json(
      createResponse({ data: { ok: true }, requestId: c.get("requestId") }),
    );
  });

  webhookRoutes.post("/shop/redact", (c) => {
    const shop = c.var.webhookShop;
    const payload = c.var.webhookPayload;
    const logger = c.get("runtimeLogger");
    logger.info(`Shop redact request from ${shop}: ${JSON.stringify(payload)}`);
    return c.json(
      createResponse({ data: { ok: true }, requestId: c.get("requestId") }),
    );
  });

  return webhookRoutes;
};

/**
 * Mounts Shopify webhook routes under the webhook prefix.
 */
export const registerWebhookRoutes = (app: Hono<AppEnv>) => {
  app.route("/webhooks", createWebhookRoutes());
};
