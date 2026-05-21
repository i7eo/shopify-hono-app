import { Hono } from "hono";
import type { AppEnv } from "./types";
import { authRoutes } from "./routes/auth";
import { webhookRoutes } from "./routes/webhooks";
import { appRoutes, renderAppShell } from "./routes/app";
import { apiRoutes } from "./routes/api";
import { ensureInstalled } from "./middleware/ensure-installed";

const app = new Hono<AppEnv>();

// Log all incoming requests
app.use("*", async (c, next) => {
  console.log(`[${c.req.method}] ${c.req.url}`);
  await next();
});

// OAuth installation flow (unauthenticated)
app.route("/auth", authRoutes);

// Webhook receivers (HMAC-verified)
app.route("/webhooks", webhookRoutes);

// Authenticated API routes (session token + token exchange)
app.route("/api", apiRoutes);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Embedded app HTML shell (ensure-installed check)
// Mounted last — Shopify loads the app at "/" while "/app" is the legacy path
app.route("/app", appRoutes);
app.get("/", ensureInstalled, (c) =>
  c.html(renderAppShell(c.env.SHOPIFY_APP_KEY)),
);

// Catch-all 404 for debugging
app.all("*", (c) => {
  console.log(`[404] No route matched: ${c.req.method} ${c.req.path}`);
  return c.json(
    { error: "Not found", path: c.req.path, method: c.req.method },
    404,
  );
});

export default app;
