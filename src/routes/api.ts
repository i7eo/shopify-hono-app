import { Hono } from "hono";
import type { AppEnv } from "../types";
import { verifySessionToken } from "../middleware/verify-session-token";
import { tokenExchange } from "../middleware/token-exchange";
import { createClient } from "../lib/shopify-client";

export const apiRoutes = new Hono<AppEnv>();

// All API routes require a valid session token + online access token
apiRoutes.use("/*", verifySessionToken);
apiRoutes.use("/*", tokenExchange);

// ---------------------------------------------------------------------------
// GET /api/shop — Fetch basic shop information
// ---------------------------------------------------------------------------

apiRoutes.get("/shop", async (c) => {
  const client = createClient(c);

  try {
    const result = await client.query<{
      shop: { name: string; email: string; myshopifyDomain: string };
    }>(`{
      shop {
        name
        email
        myshopifyDomain
      }
    }`);

    return c.json(result);
  } catch (err) {
    return c.json(
      { error: "Failed to fetch shop info", detail: (err as Error).message },
      502,
    );
  }
});

// ---------------------------------------------------------------------------
// GET /api/products — List the first 5 products (example)
// ---------------------------------------------------------------------------

apiRoutes.get("/products", async (c) => {
  const client = createClient(c);

  try {
    const result = await client.query<{
      products: {
        edges: Array<{
          node: { id: string; title: string; status: string };
        }>;
      };
    }>(`{
      products(first: 5) {
        edges {
          node {
            id
            title
            status
          }
        }
      }
    }`);

    return c.json(result);
  } catch (err) {
    return c.json(
      { error: "Failed to fetch products", detail: (err as Error).message },
      502,
    );
  }
});
