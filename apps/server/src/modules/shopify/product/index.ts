import { createClient } from "@/infra/http/client";
import { badGatewayError } from "@/shared/exceptions";
import { AppError, createResponse } from "@/shared/models";
import type { AppEnv } from "@/types";
import type { Hono } from "hono";

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

      if (result.errors?.length) {
        throw badGatewayError("Failed to fetch products", {
          details: { errors: result.errors },
        });
      }

      return c.json(
        createResponse({
          data: result.data ?? null,
          requestId: c.get("requestId"),
        }),
      );
    } catch (error) {
      if (error instanceof AppError) throw error;

      throw badGatewayError("Failed to fetch products", {
        details: {
          cause: error,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });
};
