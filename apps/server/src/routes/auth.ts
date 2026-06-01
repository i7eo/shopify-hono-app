import { Hono } from "hono";
import { hmacSha256Hex, timingSafeEqual } from "../lib/crypto";
import { SessionStore } from "../lib/session-store";
import type { AppEnv } from "../types";

const SHOP_DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

export const authRoutes = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// GET /auth — Initiate OAuth installation flow
// ---------------------------------------------------------------------------

authRoutes.get("/", async (c) => {
  const shop = c.req.query("shop");

  if (!shop || !SHOP_DOMAIN_RE.test(shop)) {
    return c.json({ error: "Invalid or missing shop parameter" }, 400);
  }

  // Generate a random state nonce for CSRF protection
  const nonceBytes = new Uint8Array(32);
  crypto.getRandomValues(nonceBytes);
  const nonce = Array.from(nonceBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Store the nonce in KV with a 10-minute TTL
  const store = new SessionStore(c.env.sofary);
  await store.setOAuthState(nonce, shop);

  // Build the Shopify authorization URL
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

// ---------------------------------------------------------------------------
// GET /auth/callback — Complete OAuth, exchange code for access token
// ---------------------------------------------------------------------------

authRoutes.get("/callback", async (c) => {
  const query = c.req.query();
  const { code, hmac, shop, state, host } = query;

  // 1. Basic parameter validation
  if (!code || !hmac || !shop || !state) {
    return c.json({ error: "Missing required OAuth callback parameters" }, 400);
  }

  if (!SHOP_DOMAIN_RE.test(shop)) {
    return c.json({ error: "Invalid shop domain" }, 400);
  }

  // 2. Validate HMAC
  //    Remove `hmac` from params, sort the rest alphabetically by key,
  //    join as key=value pairs with &, then HMAC-SHA256 hex.
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
    return c.json({ error: "HMAC validation failed" }, 401);
  }

  // 3. Validate state nonce (one-time use CSRF token)
  const store = new SessionStore(c.env.sofary);
  const storedShop = await store.getAndDeleteOAuthState(state);

  if (!storedShop || storedShop !== shop) {
    return c.json({ error: "Invalid state parameter" }, 401);
  }

  // 4. Exchange authorization code for an offline access token
  const tokenResponse = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: c.env.SHOPIFY_APP_KEY,
        client_secret: c.env.SHOPIFY_APP_SECRET,
        code,
      }),
    },
  );

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    return c.json(
      { error: "Failed to exchange authorization code", detail: errorText },
      502,
    );
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    scope: string;
  };

  // 5. Store the offline session
  await store.setOfflineSession(shop, {
    shop,
    accessToken: tokenData.access_token,
    scope: tokenData.scope,
    installedAt: new Date().toISOString(),
  });

  // 6. Redirect into the embedded app
  //    The `host` param is base64-encoded and identifies the Shopify admin host.
  if (host) {
    const decodedHost = atob(host);
    return c.redirect(`https://${decodedHost}/apps/${c.env.SHOPIFY_APP_KEY}`);
  }

  // Fallback: redirect to our own app URL
  return c.redirect(`${c.env.SHOPIFY_APP_URL}/app?shop=${shop}`);
});
