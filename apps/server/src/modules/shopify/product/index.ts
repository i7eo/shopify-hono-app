import type { Hono } from "hono";
import { createClient } from "../../../infra/http/client";
import type { AppEnv } from "../../../types";

export const registerProductRoutes = (app: Hono<AppEnv>) => {
  app.get("/products", async (c) => {
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
    } catch (error) {
      return c.json(
        { error: "Failed to fetch products", detail: (error as Error).message },
        502,
      );
    }
  });
};
