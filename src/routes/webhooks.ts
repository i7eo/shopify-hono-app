import { Hono } from "hono";
import type { AppEnv } from "../types";
import { verifyWebhook } from "../middleware/verify-webhook";
import { SessionStore } from "../lib/session-store";

export const webhookRoutes = new Hono<AppEnv>();

// All webhook routes use HMAC verification
webhookRoutes.use("/*", verifyWebhook);

// ---------------------------------------------------------------------------
// APP/UNINSTALLED — Clean up session data when the app is uninstalled
// ---------------------------------------------------------------------------

webhookRoutes.post("/app/uninstalled", async (c) => {
  const shop = c.var.webhookShop;
  const store = new SessionStore(c.env.SESSION_KV);
  await store.deleteOfflineSession(shop);
  console.log(`App uninstalled: ${shop}`);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Compliance webhooks — required by Shopify for app listing
// ---------------------------------------------------------------------------

webhookRoutes.post("/customers/data-request", async (c) => {
  const shop = c.var.webhookShop;
  const payload = c.var.webhookPayload;
  console.log(`Customer data request from ${shop}:`, payload);
  // TODO: Implement customer data export
  return c.json({ ok: true });
});

webhookRoutes.post("/customers/redact", async (c) => {
  const shop = c.var.webhookShop;
  const payload = c.var.webhookPayload;
  console.log(`Customer redact request from ${shop}:`, payload);
  // TODO: Implement customer data deletion
  return c.json({ ok: true });
});

webhookRoutes.post("/shop/redact", async (c) => {
  const shop = c.var.webhookShop;
  const payload = c.var.webhookPayload;
  console.log(`Shop redact request from ${shop}:`, payload);
  // TODO: Implement shop data deletion
  return c.json({ ok: true });
});
