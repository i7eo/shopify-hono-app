import { registerHealthController } from "@/modules/health";
import { registerApiRoutes } from "@/modules/shopify/api";
import { registerAppShellRoutes } from "@/modules/shopify/app-shell";
import { registerAuthRoutes } from "@/modules/shopify/auth";
import { registerWebhookRoutes } from "@/modules/shopify/webhook";
import type { AppOpenAPI } from "./register-openapi";

/**
 * Route aggregation only; concrete route behavior lives in modules.
 */
export function registerRoutes(app: AppOpenAPI) {
  registerAuthRoutes(app);
  registerWebhookRoutes(app);
  registerApiRoutes(app);
  registerHealthController(app);
  registerAppShellRoutes(app);
}
