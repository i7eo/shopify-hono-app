import { createMiddleware } from "hono/factory";
import { unauthorizedError } from "@/shared/exceptions";
import { verifyHS256JWT } from "@/utils";
import type { AppEnv, ShopifySessionTokenClaims } from "@/types";

const CLOCK_TOLERANCE_SECONDS = 10;

export const verifySessionToken = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw unauthorizedError("Missing or malformed Authorization header");
  }

  const token = authHeader.slice(7);

  let claims: ShopifySessionTokenClaims;
  try {
    claims = await verifyHS256JWT<ShopifySessionTokenClaims>(
      token,
      c.env.SHOPIFY_APP_SECRET,
    );
  } catch (error) {
    throw unauthorizedError("Invalid session token", {
      details: {
        cause: error,
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }

  const now = Math.floor(Date.now() / 1000);

  if (claims.exp < now - CLOCK_TOLERANCE_SECONDS) {
    throw unauthorizedError("Session token has expired");
  }

  if (claims.nbf > now + CLOCK_TOLERANCE_SECONDS) {
    throw unauthorizedError("Session token is not yet valid");
  }

  if (claims.aud !== c.env.SHOPIFY_APP_KEY) {
    throw unauthorizedError("Session token audience mismatch");
  }

  const issUrl = new URL(claims.iss);
  const destUrl = new URL(claims.dest);
  const issHost = issUrl.hostname;
  const destHost = destUrl.hostname;

  if (issHost !== destHost) {
    const issShop = issHost.split(".")[0];
    const destShop = destHost.split(".")[0];
    if (issShop !== destShop) {
      throw unauthorizedError("Session token iss/dest hostname mismatch");
    }
  }

  c.set("shopifySessionToken", claims);
  c.set("shopDomain", destHost);
  c.set("shopifyUserId", claims.sub);

  await next();
});
