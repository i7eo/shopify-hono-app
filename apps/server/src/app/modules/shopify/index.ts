import { registerAppShellRoutes } from "./app-shell";
import { registerAuthRoutes } from "./auth";
import { registerProductController } from "./product";
import { registerShopController } from "./shop";
import { registerWebhookRoutes } from "./webhook";
import type { AppOpenAPI } from "@/app/bootstrap/register-openapi";

function registerShopifyApiRoutes(app: AppOpenAPI) {
  registerShopController(app);
  registerProductController(app);
}

export function registerShopifyRoutes(app: AppOpenAPI) {
  registerAppShellRoutes(app);
  registerAuthRoutes(app);
  registerWebhookRoutes(app);
  registerShopifyApiRoutes(app);
}
