import { z } from "@hono/zod-openapi";
import { PRODUCT_EXPORT_STATUS_VALUES } from "@shamt/database/models/postgres";
import { selectProductExportSchema } from "@shamt/database/sql-schemas/postgres";
import { PaginationQuerySchema, PaginationSchema } from "@/shared/models";
import { PRODUCT_EXPORT_STATUSES } from "./utils";

export const ProductExportStatusSchema = z.enum(PRODUCT_EXPORT_STATUS_VALUES);

export const ProductExportSchema = selectProductExportSchema
  .extend({
    bucketKey: selectProductExportSchema.shape.bucketKey.openapi({
      description: "Bucket key for the generated CSV file.",
      example:
        "test-shop.myshopify.com/product-exports/2026/06/export-id/products.csv",
    }),
    bucketProvider: selectProductExportSchema.shape.bucketProvider.openapi({
      description: "Bucket provider used to store the generated CSV file.",
      example: "r2",
    }),
    completedAt: z.string().datetime().nullable().openapi({
      description: "Completion timestamp.",
      example: null,
    }),
    createdAt: z.string().datetime().openapi({
      description: "Creation timestamp.",
      example: "2026-06-18T12:00:00.000Z",
    }),
    deletedAt: z.string().datetime().nullable().openapi({
      description: "Soft deletion timestamp.",
      example: null,
    }),
    id: selectProductExportSchema.shape.id.openapi({
      description: "Product export ID.",
      example: "8f07a37b-b7dc-41f0-a9d5-3f9c28e12f2a",
    }),
    name: selectProductExportSchema.shape.name.openapi({
      description: "Merchant-facing export name.",
      example: "All products",
    }),
    shopDomain: selectProductExportSchema.shape.shopDomain.openapi({
      description: "Shopify shop domain that owns the export.",
      example: "test-shop.myshopify.com",
    }),
    shopifyBulkOperationId:
      selectProductExportSchema.shape.shopifyBulkOperationId.openapi({
        description: "Shopify BulkOperation GraphQL ID.",
        example: "gid://shopify/BulkOperation/1234567890",
      }),
    shopifySessionId: selectProductExportSchema.shape.shopifySessionId.openapi({
      description: "Offline Shopify session ID used to start the export.",
      example: "offline_test-shop.myshopify.com",
    }),
    status: ProductExportStatusSchema.openapi({
      description: "Product export lifecycle status.",
      example: PRODUCT_EXPORT_STATUSES.BULK_OPERATION_RUNNING,
    }),
    updatedAt: z.string().datetime().openapi({
      description: "Update timestamp.",
      example: "2026-06-18T12:00:00.000Z",
    }),
  })
  .openapi({
    description: "Product export metadata.",
  });

export const CreateProductExportBodySchema = z.object({
  name: z.string().min(1).max(120).openapi({
    description: "Export name.",
    example: "All products",
  }),
});

export const ProductExportListSchema = z.object({
  pagination: PaginationSchema,
  result: z.array(ProductExportSchema),
});

export const ProductExportDownloadTargetSchema = z.object({
  type: z.enum(["redirect", "stream"]).openapi({
    description: "Browser download strategy for the generated CSV.",
    example: "redirect",
  }),
  url: z.string().url().openapi({
    description:
      "Download URL. Redirect URLs may point to short-lived R2 URLs.",
    example: "https://signed.example.com/products.csv",
  }),
});

export const ProductExportIdParamsSchema = z.object({
  id: z.string().min(1).openapi({
    description: "Product export ID.",
    example: "8f07a37b-b7dc-41f0-a9d5-3f9c28e12f2a",
  }),
});

export const ProductExportListQuerySchema = PaginationQuerySchema.extend({
  status: ProductExportStatusSchema.optional().openapi({
    description: "Filter by export status.",
    example: PRODUCT_EXPORT_STATUSES.READY,
  }),
});
