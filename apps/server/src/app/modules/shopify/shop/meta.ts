import { createRoute, z } from "@hono/zod-openapi";
import { tokenExchange, verifySessionToken } from "@/shared/middlewares";
import { ErrorSchema, ResponseSchema } from "@/shared/models";
import { apiPath, tag } from "../constants";

export const ShopifyShopDataSchema = z.object({
  shop: z.object({
    name: z.string().openapi({
      description: "Shop display name.",
      example: "My Shopify Store",
    }),
    email: z.string().email().openapi({
      description: "Shop contact email.",
      example: "merchant@example.com",
    }),
    myshopifyDomain: z.string().openapi({
      description: "Shop myshopify.com domain.",
      example: "my-store.myshopify.com",
    }),
  }),
});

export const getShopRoute = createRoute({
  method: "get",
  path: `${apiPath}/shop`,
  middleware: [verifySessionToken, tokenExchange] as const,
  tags: [tag, `${tag}: Shop`],
  summary: "Shop info",
  description: "Fetch basic Shopify shop information for the embedded app.",
  responses: {
    200: {
      description: "Shop information.",
      content: {
        "application/json": {
          schema: ResponseSchema(ShopifyShopDataSchema),
        },
      },
    },
    401: {
      description: "Missing or invalid Shopify session token.",
      content: {
        "application/json": {
          schema: ErrorSchema(z.null()),
        },
      },
    },
    502: {
      description: "Shopify Admin API request failed.",
      content: {
        "application/json": {
          schema: ErrorSchema(z.null()),
        },
      },
    },
  },
});
