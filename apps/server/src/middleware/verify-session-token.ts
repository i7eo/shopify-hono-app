import { createMiddleware } from "hono/factory";
import { verifyHS256JWT } from "../lib/crypto";
import type { AppEnv, ShopifySessionTokenClaims } from "../types";

/** Clock skew tolerance in seconds for JWT exp/nbf checks. */
const CLOCK_TOLERANCE_SECONDS = 10;

/**
 * Middleware that validates Shopify session tokens (JWTs) from the
 * `Authorization: Bearer <token>` header.
 *
 * Session tokens are issued by App Bridge and have a 1-minute lifetime.
 * They authenticate requests from the embedded app frontend to our backend.
 *
 * On success, sets:
 *   c.var.shopifySessionToken — parsed JWT claims
 *   c.var.shopDomain          — e.g. "my-store.myshopify.com"
 *   c.var.shopifyUserId       — Shopify user ID (claims.sub)
 */
export const verifySessionToken = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or malformed Authorization header" }, 401);
  }

  const token = authHeader.slice(7);

  let claims: ShopifySessionTokenClaims;
  try {
    claims = await verifyHS256JWT<ShopifySessionTokenClaims>(
      token,
      c.env.SHOPIFY_APP_SECRET,
    );
  } catch (error) {
    return c.json(
      { error: "Invalid session token", detail: (error as Error).message },
      401,
    );
  }

  const now = Math.floor(Date.now() / 1000);

  // Check expiration (with clock skew tolerance)
  if (claims.exp < now - CLOCK_TOLERANCE_SECONDS) {
    return c.json({ error: "Session token has expired" }, 401);
  }

  // Check not-before (with clock skew tolerance)
  if (claims.nbf > now + CLOCK_TOLERANCE_SECONDS) {
    return c.json({ error: "Session token is not yet valid" }, 401);
  }

  // Check audience matches our app's client ID
  if (claims.aud !== c.env.SHOPIFY_APP_KEY) {
    return c.json({ error: "Session token audience mismatch" }, 401);
  }

  // Validate iss and dest refer to the same shop
  // iss = https://{shop}.myshopify.com/admin
  // dest = https://{shop}.myshopify.com
  const issUrl = new URL(claims.iss);
  const destUrl = new URL(claims.dest);

  // Extract shop domain — iss has /admin path, dest does not
  const issHost = issUrl.hostname;
  const destHost = destUrl.hostname;

  if (issHost !== destHost) {
    // In some Shopify dev/spin environments, the hosts may legitimately differ.
    // Fall back to comparing the shop name portion (everything before the first dot
    // or before .myshopify.com).
    const issShop = issHost.split(".")[0];
    const destShop = destHost.split(".")[0];
    if (issShop !== destShop) {
      return c.json({ error: "Session token iss/dest hostname mismatch" }, 401);
    }
  }

  // Extract the shop domain from dest (more reliable — no /admin suffix)
  const shopDomain = destHost;

  c.set("shopifySessionToken", claims);
  c.set("shopDomain", shopDomain);
  c.set("shopifyUserId", claims.sub);

  await next();
});
