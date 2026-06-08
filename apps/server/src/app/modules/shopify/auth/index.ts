import { Hono } from "hono";
import { getShopifyConfigProvider } from "@/infra/provider";
import { badRequestError } from "@/shared/exceptions";
import { getShopifySessionStorage } from "../session-storage";
import type { AppEnv } from "@/types";

const SHOP_DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

export const createAuthRoutes = () => {
  const authRoutes = new Hono<AppEnv>();

  authRoutes.get("/", async (c) => {
    const shop = c.req.query("shop");
    const config = c.get("runtimeEnv");
    const shopify = await getShopifyConfigProvider(config);

    if (!shop || !SHOP_DOMAIN_RE.test(shop)) {
      throw badRequestError("Invalid or missing shop parameter");
    }

    return shopify.auth.begin({
      shop,
      callbackPath: "/auth/callback",
      isOnline: false,
      rawRequest: c.req.raw,
    });
  });

  authRoutes.get("/callback", async (c) => {
    const config = c.get("runtimeEnv");
    const shopify = await getShopifyConfigProvider(config);
    const { headers, session } = await shopify.auth.callback({
      rawRequest: c.req.raw,
    });

    await getShopifySessionStorage(c).storeSession(session);

    const responseHeaders = new Headers(headers);
    const host = c.req.query("host");
    if (host) {
      responseHeaders.set("Location", shopify.auth.buildEmbeddedAppUrl(host));
    } else {
      responseHeaders.set(
        "Location",
        `${config.SHOPIFY_APP_URL}/app?shop=${session.shop}`,
      );
    }

    return new Response(null, {
      status: 302,
      statusText: "Found",
      headers: responseHeaders,
    });
  });

  return authRoutes;
};

export const registerAuthRoutes = (app: Hono<AppEnv>) => {
  app.route("/auth", createAuthRoutes());
};
