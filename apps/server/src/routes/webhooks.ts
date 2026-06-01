import { Hono } from "hono";
import { SessionStore } from "../lib/session-store";
import { verifyWebhook } from "../middleware/verify-webhook";
import type { AppEnv } from "../types";

export const webhookRoutes = new Hono<AppEnv>();

// All webhook routes use HMAC verification
webhookRoutes.use("/*", verifyWebhook);

// ---------------------------------------------------------------------------
// APP/UNINSTALLED — Clean up session data when the app is uninstalled
// ---------------------------------------------------------------------------

webhookRoutes.post("/app/uninstalled", async (c) => {
  const shop = c.var.webhookShop;
  const store = new SessionStore(c.env.sofary);
  await store.deleteOfflineSession(shop);
  // eslint-disable-next-line no-console
  console.log(`App uninstalled: ${shop}`);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Compliance webhooks — required by Shopify for app listing
// ---------------------------------------------------------------------------

webhookRoutes.post("/customers/data-request", (c) => {
  const shop = c.var.webhookShop;
  const payload = c.var.webhookPayload;
  // eslint-disable-next-line no-console
  console.log(`Customer data request from ${shop}:`, payload);
  // TODO: Implement customer data export
  return c.json({ ok: true });
});

webhookRoutes.post("/customers/redact", (c) => {
  const shop = c.var.webhookShop;
  const payload = c.var.webhookPayload;
  // eslint-disable-next-line no-console
  console.log(`Customer redact request from ${shop}:`, payload);
  // TODO: Implement customer data deletion
  return c.json({ ok: true });
});

webhookRoutes.post("/shop/redact", (c) => {
  const shop = c.var.webhookShop;
  const payload = c.var.webhookPayload;
  // eslint-disable-next-line no-console
  console.log(`Shop redact request from ${shop}:`, payload);
  // TODO: Implement shop data deletion
  return c.json({ ok: true });
});
