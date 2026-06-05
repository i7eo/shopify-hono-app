import { registerApiRoutes } from "../../modules/api";
import { registerAppShellRoutes } from "../../modules/app-shell";
import { registerAuthRoutes } from "../../modules/auth";
import { registerHealthRoutes } from "../../modules/health";
import { registerWebhookRoutes } from "../../modules/shopify/webhook";
import type { AppEnv } from "../../types";
import type { Hono } from "hono";

/**
 * Route aggregation only; concrete route behavior lives in modules.
 */
export const registerRoutes = (app: Hono<AppEnv>) => {
  registerAuthRoutes(app);
  registerWebhookRoutes(app);
  registerApiRoutes(app);
  registerHealthRoutes(app);
  registerAppShellRoutes(app);

  app.all("*", (c) => {
    // eslint-disable-next-line no-console
    console.log(`[404] No route matched: ${c.req.method} ${c.req.path}`);
    return c.json(
      { error: "Not found", path: c.req.path, method: c.req.method },
      404,
    );
  });
};
