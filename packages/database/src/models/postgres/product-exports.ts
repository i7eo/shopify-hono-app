import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const PRODUCT_EXPORT_STATUS_VALUES = [
  "queued",
  "bulk_operation_running",
  "bulk_operation_completed",
  "generating_csv",
  "ready",
  "requires_node_finalize",
  "failed",
  "canceled",
] as const;

export const PRODUCT_EXPORT_PART_STATUS_VALUES = [
  "pending",
  "processing",
  "done",
  "failed",
] as const;

export const productExportStatusEnum = pgEnum(
  "product_export_status",
  PRODUCT_EXPORT_STATUS_VALUES,
);

export const productExportPartStatusEnum = pgEnum(
  "product_export_part_status",
  PRODUCT_EXPORT_PART_STATUS_VALUES,
);

export const productExports = pgTable(
  "product_exports",
  {
    id: text("id").primaryKey(),
    shopDomain: text("shop_domain").notNull(),
    name: text("name").notNull(),
    status: productExportStatusEnum("status").notNull(),
    shopifyBulkOperationId: text("shopify_bulk_operation_id"),
    shopifyBulkOperationStatus: text("shopify_bulk_operation_status"),
    resultUrl: text("result_url"),
    partialDataUrl: text("partial_data_url"),
    objectCount: bigint("object_count", { mode: "number" }),
    fileSize: bigint("file_size", { mode: "number" }),
    bucketProvider: text("bucket_provider"),
    bucketKey: text("bucket_key"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("product_exports_shop_created_at_idx").on(
      table.shopDomain,
      table.createdAt,
    ),
    index("product_exports_shop_status_idx").on(table.shopDomain, table.status),
    index("product_exports_bulk_operation_idx").on(
      table.shopifyBulkOperationId,
    ),
  ],
);

export const productExportParts = pgTable(
  "product_export_parts",
  {
    id: text("id").primaryKey(),
    exportId: text("export_id")
      .notNull()
      .references(() => productExports.id, { onDelete: "cascade" }),
    seq: bigint("seq", { mode: "number" }).notNull(),
    status: productExportPartStatusEnum("status").notNull(),
    rangeStart: bigint("range_start", { mode: "number" }).notNull(),
    rangeEnd: bigint("range_end", { mode: "number" }).notNull(),
    bucketProvider: text("bucket_provider"),
    bucketKey: text("bucket_key"),
    byteSize: bigint("byte_size", { mode: "number" }),
    rowCount: bigint("row_count", { mode: "number" }),
    attempts: bigint("attempts", { mode: "number" }).notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("product_export_parts_export_seq_idx").on(
      table.exportId,
      table.seq,
    ),
    index("product_export_parts_export_status_idx").on(
      table.exportId,
      table.status,
    ),
  ],
);
