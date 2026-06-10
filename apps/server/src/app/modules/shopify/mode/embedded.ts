import { createMiddleware } from "hono/factory";
import {
  tokenExchange,
  verifySessionToken,
} from "@/shared/middlewares/shopify";
import { renderEmbeddedAppShell } from "../app-shell/templates";
import { refreshShopifyOnlineSession } from "../session";
import type { ShopifyModeCapabilities } from "./capabilities";
import type { AppEnv } from "@/typings";

/**
 * Defines the Shopify app-mode behavior for embedded Admin iframe requests.
 */
export const embeddedShopifyModeCapabilities: ShopifyModeCapabilities = {
  isEmbeddedApp: true,
  buildAppShellResponse: (c) =>
    c.html(renderEmbeddedAppShell(c.get("runtimeEnv").SHOPIFY_APP_KEY)),
  renderAppShell: renderEmbeddedAppShell,
  authenticateAdminRequest: createMiddleware<AppEnv>(async (c, next) => {
    await verifySessionToken(c, async () => {
      await tokenExchange(c, next);
    });
  }),
  refreshAdminSession: refreshShopifyOnlineSession,
  buildAuthCallbackRedirect: (c, shopify, session, headers) => {
    const responseHeaders = new Headers(headers);
    const host = c.req.query("host");

    if (host) {
      responseHeaders.set("Location", shopify.auth.buildEmbeddedAppUrl(host));
    } else {
      responseHeaders.set(
        "Location",
        `${c.get("runtimeEnv").SHOPIFY_APP_URL}/app?shop=${session.shop}`,
      );
    }

    return new Response(null, {
      status: 302,
      statusText: "Found",
      headers: responseHeaders,
    });
  },
};
