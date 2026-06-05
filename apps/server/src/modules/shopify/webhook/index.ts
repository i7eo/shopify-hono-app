import { Hono } from "hono";
import { SessionStore } from "../../../infra/cloudflare/kv";
import { verifyWebhook } from "../../../shared/middlewares";
import type { AppEnv } from "../../../types";

export const createWebhookRoutes = () => {
  const webhookRoutes = new Hono<AppEnv>();

  webhookRoutes.use("/*", verifyWebhook);

  webhookRoutes.post("/app/uninstalled", async (c) => {
    const shop = c.var.webhookShop;
    const store = new SessionStore(c.env.sofary);
    await store.deleteOfflineSession(shop);
    // eslint-disable-next-line no-console
    console.log(`App uninstalled: ${shop}`);
    return c.json({ ok: true });
  });

  webhookRoutes.post("/customers/data-request", (c) => {
    const shop = c.var.webhookShop;
    const payload = c.var.webhookPayload;
    // eslint-disable-next-line no-console
    console.log(`Customer data request from ${shop}:`, payload);
    return c.json({ ok: true });
  });

  webhookRoutes.post("/customers/redact", (c) => {
    const shop = c.var.webhookShop;
    const payload = c.var.webhookPayload;
    // eslint-disable-next-line no-console
    console.log(`Customer redact request from ${shop}:`, payload);
    return c.json({ ok: true });
  });

  webhookRoutes.post("/shop/redact", (c) => {
    const shop = c.var.webhookShop;
    const payload = c.var.webhookPayload;
    // eslint-disable-next-line no-console
    console.log(`Shop redact request from ${shop}:`, payload);
    return c.json({ ok: true });
  });

  return webhookRoutes;
};

export const webhookRoutes = createWebhookRoutes();

export const registerWebhookRoutes = (app: Hono<AppEnv>) => {
  app.route("/webhooks", createWebhookRoutes());
};
