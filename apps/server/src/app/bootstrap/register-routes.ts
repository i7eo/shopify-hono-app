import { registerHealthRoutes } from "@/modules/health";
import { registerApiRoutes } from "@/modules/shopify/api";
import { registerAppShellRoutes } from "@/modules/shopify/app-shell";
import { registerAuthRoutes } from "@/modules/shopify/auth";
import { registerWebhookRoutes } from "@/modules/shopify/webhook";
import type { AppEnv } from "@/types";
import type { Hono } from "hono";

/**
 * Route aggregation only; concrete route behavior lives in modules.
 */
export function registerRoutes(app: Hono<AppEnv>) {
  registerAuthRoutes(app);
  registerWebhookRoutes(app);
  registerApiRoutes(app);
  registerHealthRoutes(app);
  registerAppShellRoutes(app);
}
