import type { Hono } from "hono";
import { createClient } from "../../../infra/http/client";
import type { AppEnv } from "../../../types";

export const registerShopRoutes = (app: Hono<AppEnv>) => {
  app.get("/shop", async (c) => {
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
    } catch (error) {
      return c.json(
        {
          error: "Failed to fetch shop info",
          detail: (error as Error).message,
        },
        502,
      );
    }
  });
};
