import { registerFileController } from "@/app/modules/file";
import { registerHealthController } from "@/app/modules/health";
import { registerProductController } from "@/app/modules/product";
import { registerProductExportController } from "@/app/modules/product-export";
import { registerReferenceController } from "@/app/modules/reference";
import { registerShopController } from "@/app/modules/shop";
import { registerShopifyRoutes } from "@/app/modules/shopify";
import type { AppOpenAPI } from "./register-openapi";

/**
 * Route aggregation only; concrete route behavior lives in modules.
 */
export function registerRoutes(app: AppOpenAPI) {
  registerHealthController(app);
  registerShopifyRoutes(app);
  registerFileController(app);
  registerShopController(app);
  registerProductController(app);
  registerProductExportController(app);
  registerReferenceController(app);
}
