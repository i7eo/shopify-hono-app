import { z } from "@hono/zod-openapi";

export const FileStatusSchema = z.enum([
  "uploading",
  "available",
  "expired",
  "deleted",
  "failed",
]);

export const FileSchema = z.object({
  id: z.string().openapi({
    description: "File resource ID.",
    example: "8f07a37b-b7dc-41f0-a9d5-3f9c28e12f2a",
  }),
  originalName: z.string().openapi({
    description: "Original uploaded filename.",
    example: "invoice.pdf",
  }),
  safeName: z.string().openapi({
    description: "Sanitized filename used for storage path suffix.",
    example: "invoice.pdf",
  }),
  contentType: z.string().openapi({
    description: "Uploaded file MIME type.",
    example: "application/pdf",
  }),
  byteSize: z.number().int().nonnegative().openapi({
    description: "Uploaded file size in bytes.",
    example: 1024,
  }),
  status: FileStatusSchema.openapi({
    description: "File lifecycle status.",
    example: "available",
  }),
  expiresAt: z.string().datetime().openapi({
    description: "File expiration timestamp.",
    example: "2026-06-14T12:00:00.000Z",
  }),
  createdAt: z.string().datetime().openapi({
    description: "File creation timestamp.",
    example: "2026-06-13T12:00:00.000Z",
  }),
  updatedAt: z.string().datetime().openapi({
    description: "File update timestamp.",
    example: "2026-06-13T12:00:00.000Z",
  }),
});

export const FileListSchema = z.object({
  files: z.array(FileSchema),
  nextCursor: z.string().optional(),
});

export const FileUploadListSchema = z.object({
  files: z.array(FileSchema),
});

export const FileIdParamsSchema = z.object({
  id: z.string().min(1).openapi({
    description: "File resource ID.",
    example: "8f07a37b-b7dc-41f0-a9d5-3f9c28e12f2a",
  }),
});

export const FileListQuerySchema = z.object({
  cursor: z.string().optional().openapi({
    description: "Cursor returned by a previous file list response.",
  }),
  limit: z.coerce.number().int().min(1).max(100).optional().openapi({
    description: "Maximum number of files to return.",
    example: 20,
  }),
});
