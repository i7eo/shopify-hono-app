import { createMiddleware } from "hono/factory";
import { verifyHS256JWT } from "../utils";
import type { AppEnv, ShopifySessionTokenClaims } from "../../../types";

const CLOCK_TOLERANCE_SECONDS = 10;

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

  if (claims.exp < now - CLOCK_TOLERANCE_SECONDS) {
    return c.json({ error: "Session token has expired" }, 401);
  }

  if (claims.nbf > now + CLOCK_TOLERANCE_SECONDS) {
    return c.json({ error: "Session token is not yet valid" }, 401);
  }

  if (claims.aud !== c.env.SHOPIFY_APP_KEY) {
    return c.json({ error: "Session token audience mismatch" }, 401);
  }

  const issUrl = new URL(claims.iss);
  const destUrl = new URL(claims.dest);
  const issHost = issUrl.hostname;
  const destHost = destUrl.hostname;

  if (issHost !== destHost) {
    const issShop = issHost.split(".")[0];
    const destShop = destHost.split(".")[0];
    if (issShop !== destShop) {
      return c.json({ error: "Session token iss/dest hostname mismatch" }, 401);
    }
  }

  c.set("shopifySessionToken", claims);
  c.set("shopDomain", destHost);
  c.set("shopifyUserId", claims.sub);

  await next();
});
