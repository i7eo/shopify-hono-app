import { createMiddleware } from "hono/factory";
import { unauthorizedError } from "@/shared/exceptions";
import {
  commitShopifyAccountSession,
  createShopifyAccountSession,
  hasShopifyAccountSession,
  loadShopifySessionForAccount,
} from "../account/session";
import { renderStandaloneAppShell } from "../app-shell/templates";
import { setShopifySessionContext } from "../session";
import type { ShopifyModeCapabilities } from "./capabilities";
import type { AppEnv } from "@/typings";

/**
 * Defines the Shopify app-mode behavior for standalone browser requests.
 */
export const standaloneShopifyModeCapabilities: ShopifyModeCapabilities = {
  isEmbeddedApp: false,
  buildAppShellResponse: (c) => {
    const shop = c.req.query("shop");

    if (!hasShopifyAccountSession(c) && shop) {
      const authUrl = new URL("/auth", c.get("runtimeEnv").SHOPIFY_APP_URL);
      authUrl.searchParams.set("shop", shop);

      return c.redirect(authUrl.toString());
    }

    return c.html(
      renderStandaloneAppShell(c.get("runtimeEnv").SHOPIFY_APP_KEY),
    );
  },
  renderAppShell: renderStandaloneAppShell,
  authenticateAdminRequest: createMiddleware<AppEnv>(async (c, next) => {
    const session = await loadShopifySessionForAccount(c);
    c.set("shopDomain", session.shop);
    setShopifySessionContext(c, session);
    await next();
  }),
  refreshAdminSession: () => {
    throw unauthorizedError(
      "Standalone Shopify session expired or was revoked",
    );
  },
  buildAuthCallbackRedirect: (c, _shopify, session, headers) => {
    const responseHeaders = new Headers(headers);
    responseHeaders.append(
      "Set-Cookie",
      commitShopifyAccountSession(c, createShopifyAccountSession(session)),
    );
    responseHeaders.set(
      "Location",
      `${c.get("runtimeEnv").SHOPIFY_APP_URL}/app`,
    );

    return new Response(null, {
      status: 302,
      statusText: "Found",
      headers: responseHeaders,
    });
  },
};
