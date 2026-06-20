import { z } from "@hono/zod-openapi";
import { selectPostgresReferenceSchema } from "@shamt/database/sql-schemas/postgres";
import { PaginationQuerySchema, PaginationSchema } from "@/shared/models";

export const ReferenceSchema = selectPostgresReferenceSchema
  .extend({
    createdAt: z.string().datetime().openapi({
      description: "Reference creation timestamp.",
      example: "2026-06-21T12:00:00.000Z",
    }),
    deletedAt: z.string().datetime().nullable().openapi({
      description: "Reference deletion timestamp.",
      example: null,
    }),
    id: selectPostgresReferenceSchema.shape.id.openapi({
      description: "Reference ID.",
      example: "8f07a37b-b7dc-41f0-a9d5-3f9c28e12f2a",
    }),
    namespace: selectPostgresReferenceSchema.shape.namespace.openapi({
      description: "Reference namespace.",
      example: "gender",
    }),
    shopDomain: selectPostgresReferenceSchema.shape.shopDomain.openapi({
      description: "Shopify shop domain that owns the reference.",
      example: "test-shop.myshopify.com",
    }),
    updatedAt: z.string().datetime().openapi({
      description: "Reference update timestamp.",
      example: "2026-06-21T12:00:00.000Z",
    }),
  })
  .openapi({
    description: "Reference.",
  });

export const ReferenceListSchema = z.object({
  pagination: PaginationSchema,
  result: z.array(ReferenceSchema),
});

export const ReferenceNamespaceParamsSchema = z.object({
  namespace: z.string().min(1).max(80).openapi({
    description: "Reference namespace.",
    example: "gender",
  }),
});

export const ReferenceIdParamsSchema = ReferenceNamespaceParamsSchema.extend({
  id: z.string().min(1).openapi({
    description: "Reference ID.",
    example: "8f07a37b-b7dc-41f0-a9d5-3f9c28e12f2a",
  }),
});

export const ReferenceListQuerySchema = PaginationQuerySchema.extend({
  enabled: z.coerce.boolean().optional().openapi({
    description: "Filter by enabled state.",
    example: true,
  }),
});

export const CreateReferenceBodySchema = z.object({
  code: z.string().min(1).max(80).openapi({
    description: "Stable machine-readable reference code.",
    example: "unknown",
  }),
  enabled: z.boolean().optional().openapi({
    description: "Whether the reference can be selected by operators.",
    example: true,
  }),
  label: z.string().min(1).max(120).openapi({
    description: "Human-readable reference label.",
    example: "Unknown",
  }),
  sortOrder: z.number().int().optional().openapi({
    description: "Display order within the namespace.",
    example: 30,
  }),
});

export const UpdateReferenceBodySchema = z
  .object({
    code: z.string().min(1).max(80).optional().openapi({
      description: "Stable machine-readable reference code.",
      example: "unknown",
    }),
    enabled: z.boolean().optional().openapi({
      description: "Whether the reference can be selected by operators.",
      example: true,
    }),
    label: z.string().min(1).max(120).optional().openapi({
      description: "Human-readable reference label.",
      example: "Unknown",
    }),
    sortOrder: z.number().int().optional().openapi({
      description: "Display order within the namespace.",
      example: 30,
    }),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
