import { registerHealthController } from "@/app/modules/health";
import { registerApiRoutes } from "@/app/modules/shopify/api";
import { registerAppShellRoutes } from "@/app/modules/shopify/app-shell";
import { registerAuthRoutes } from "@/app/modules/shopify/auth";
import { registerWebhookRoutes } from "@/app/modules/shopify/webhook";
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
