import { registerHealthController } from "@/app/modules/health";
import { registerShopifyRoutes } from "@/app/modules/shopify";
import type { AppOpenAPI } from "./register-openapi";

/**
 * Route aggregation only; concrete route behavior lives in modules.
 */
export function registerRoutes(app: AppOpenAPI) {
  registerHealthController(app);
  registerShopifyRoutes(app);
}
