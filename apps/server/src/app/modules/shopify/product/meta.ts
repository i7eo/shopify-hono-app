import { createRoute, z } from "@hono/zod-openapi";
import { tokenExchange, verifySessionToken } from "@/shared/middlewares";
import { ErrorSchema, ResponseSchema } from "@/shared/models";
import { apiPath, tag } from "../constants";

export const ShopifyProductsDataSchema = z.object({
  products: z.object({
    edges: z.array(
      z.object({
        node: z.object({
          id: z.string().openapi({
            description: "Product GraphQL ID.",
            example: "gid://shopify/Product/1234567890",
          }),
          title: z.string().openapi({
            description: "Product title.",
            example: "Snowboard",
          }),
          status: z.string().openapi({
            description: "Product status.",
            example: "ACTIVE",
          }),
        }),
      }),
    ),
  }),
});

export const getProductsRoute = createRoute({
  method: "get",
  path: `${apiPath}/products`,
  middleware: [verifySessionToken, tokenExchange] as const,
  tags: [tag, `${tag}: Product`],
  summary: "Products",
  description: "Fetch a sample list of Shopify products for the embedded app.",
  responses: {
    200: {
      description: "Products list.",
      content: {
        "application/json": {
          schema: ResponseSchema(ShopifyProductsDataSchema),
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
