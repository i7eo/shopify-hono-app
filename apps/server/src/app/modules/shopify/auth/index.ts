import { serializeValue } from "@shamt/utils";
import { Hono } from "hono";
import { SessionStore } from "@/infra/cloudflare/kv";
import {
  badGatewayError,
  badRequestError,
  unauthorizedError,
} from "@/shared/exceptions";
import { hmacSha256Hex, timingSafeEqual } from "@/utils";
import type { AppEnv } from "@/types";

const SHOP_DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

export const createAuthRoutes = () => {
  const authRoutes = new Hono<AppEnv>();

  authRoutes.get("/", async (c) => {
    const shop = c.req.query("shop");

    if (!shop || !SHOP_DOMAIN_RE.test(shop)) {
      throw badRequestError("Invalid or missing shop parameter");
    }

    const nonceBytes = new Uint8Array(32);
    crypto.getRandomValues(nonceBytes);
    const nonce = Array.from(nonceBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const store = new SessionStore(c.env.sofary);
    await store.setOAuthState(nonce, shop);

    const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authUrl.searchParams.set("client_id", c.env.SHOPIFY_APP_KEY);
    authUrl.searchParams.set("scope", c.env.SCOPES);
    authUrl.searchParams.set(
      "redirect_uri",
      `${c.env.SHOPIFY_APP_URL}/auth/callback`,
    );
    authUrl.searchParams.set("state", nonce);

    return c.redirect(authUrl.toString());
  });

  authRoutes.get("/callback", async (c) => {
    const query = c.req.query();
    const { code, hmac, shop, state, host } = query;

    if (!code || !hmac || !shop || !state) {
      throw badRequestError("Missing required OAuth callback parameters");
    }

    if (!SHOP_DOMAIN_RE.test(shop)) {
      throw badRequestError("Invalid shop domain");
    }

    const params = new URLSearchParams(c.req.url.split("?")[1] || "");
    params.delete("hmac");
    const sortedParams = Array.from(params.entries())
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");

    const computedHmac = await hmacSha256Hex(
      c.env.SHOPIFY_APP_SECRET,
      sortedParams,
    );
    const hmacValid = await timingSafeEqual(computedHmac, hmac);

    if (!hmacValid) {
      throw unauthorizedError("HMAC validation failed");
    }

    const store = new SessionStore(c.env.sofary);
    const storedShop = await store.getAndDeleteOAuthState(state);

    if (!storedShop || storedShop !== shop) {
      throw unauthorizedError("Invalid state parameter");
    }

    const tokenResponse = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: serializeValue({
          client_id: c.env.SHOPIFY_APP_KEY,
          client_secret: c.env.SHOPIFY_APP_SECRET,
          code,
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw badGatewayError("Failed to exchange authorization code", {
        details: {
          status: tokenResponse.status,
          body: errorText,
        },
      });
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      scope: string;
    };

    await store.setOfflineSession(shop, {
      shop,
      accessToken: tokenData.access_token,
      scope: tokenData.scope,
      installedAt: new Date().toISOString(),
    });

    if (host) {
      const decodedHost = atob(host);
      return c.redirect(`https://${decodedHost}/apps/${c.env.SHOPIFY_APP_KEY}`);
    }

    return c.redirect(`${c.env.SHOPIFY_APP_URL}/app?shop=${shop}`);
  });

  return authRoutes;
};

export const authRoutes = createAuthRoutes();

export const registerAuthRoutes = (app: Hono<AppEnv>) => {
  app.route("/auth", createAuthRoutes());
};
