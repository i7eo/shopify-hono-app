import { createClient } from "@/infra/http/client";
import { badGatewayError } from "@/shared/exceptions";
import { AppError, createResponse } from "@/shared/models";
import type { AppEnv } from "@/types";
import type { Hono } from "hono";

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

      if (result.errors?.length) {
        throw badGatewayError("Failed to fetch shop info", {
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

      throw badGatewayError("Failed to fetch shop info", {
        details: {
          cause: error,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });
};
