import {
  productExportParts,
  productExports,
} from "@shamt/database/models/postgres";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  PRODUCT_EXPORT_PART_STATUSES,
  PRODUCT_EXPORT_RETRYABLE_PART_STATUSES,
  PRODUCT_EXPORT_STATUSES,
} from "../../utils";
import {
  getListCursor,
  getPageOffset,
  toPartStats,
  toProductExportsPage,
} from "./shared";
import type {
  ProductExportListInput,
  ProductExportLookup,
  ProductExportPartLookup,
  ProductExportPartRecord,
  ProductExportPartStats,
  ProductExportPartStatus,
  ProductExportRecord,
  ProductExportsPage,
  ProductExportStore,
} from "../../types";
import type { PostgresDatabase } from "@/infra/database";
import type { SeekCursor } from "@/shared/models";

export async function createPostgresProductExportParts(
  database: PostgresDatabase,
  parts: ProductExportPartRecord[],
): Promise<void> {
  if (parts.length === 0) return;

  await database.db
    .insert(productExportParts)
    .values(parts)
    .onConflictDoNothing({
      target: [productExportParts.exportId, productExportParts.seq],
    });
}

export async function createPostgresProductExport(
  database: PostgresDatabase,
  record: ProductExportRecord,
): Promise<void> {
  await database.db.insert(productExports).values(record).onConflictDoUpdate({
    target: productExports.id,
    set: record,
  });
}

export async function updatePostgresProductExport(
  database: PostgresDatabase,
  record: ProductExportRecord,
): Promise<void> {
  await database.db
    .update(productExports)
    .set(record)
    .where(
      and(
        eq(productExports.id, record.id),
        eq(productExports.shopDomain, record.shopDomain),
      ),
    );
}

export async function findPostgresProductExportById(
  database: PostgresDatabase,
  input: ProductExportLookup,
): Promise<ProductExportRecord | null> {
  const [record] = await database.db
    .select()
    .from(productExports)
    .where(
      and(
        eq(productExports.id, input.id),
        eq(productExports.shopDomain, input.shopDomain),
        isNull(productExports.deletedAt),
      ),
    )
    .limit(1);

  return record ?? null;
}

export async function findPostgresProductExportByBulkOperationId(
  database: PostgresDatabase,
  bulkOperationId: string,
): Promise<ProductExportRecord | null> {
  const [record] = await database.db
    .select()
    .from(productExports)
    .where(eq(productExports.shopifyBulkOperationId, bulkOperationId))
    .limit(1);

  return record ?? null;
}

export async function claimPostgresProductExportPart(
  database: PostgresDatabase,
  input: ProductExportPartLookup,
): Promise<ProductExportPartRecord | null> {
  const now = new Date();
  const [record] = await database.db
    .update(productExportParts)
    .set({
      attempts: sql`${productExportParts.attempts} + 1`,
      errorCode: null,
      errorMessage: null,
      lockedAt: now,
      status: PRODUCT_EXPORT_PART_STATUSES.PROCESSING,
      updatedAt: now,
    })
    .where(
      and(
        eq(productExportParts.exportId, input.exportId),
        eq(productExportParts.seq, input.seq),
        inArray(productExportParts.status, [
          ...PRODUCT_EXPORT_RETRYABLE_PART_STATUSES,
        ]),
      ),
    )
    .returning();

  return record ?? null;
}

export async function listPostgresProductExports(
  database: PostgresDatabase,
  input: ProductExportListInput,
): Promise<ProductExportsPage> {
  const cursor = getListCursor(input);
  const where = getPostgresListWhere(input, cursor);
  const query = database.db
    .select()
    .from(productExports)
    .where(where)
    .orderBy(desc(productExports.createdAt), desc(productExports.id))
    .limit(input.pagination.limit + 1);

  const rows =
    input.pagination.mode === "page"
      ? await query.offset(getPageOffset(input.pagination))
      : await query;
  const total =
    input.pagination.mode === "page"
      ? await countPostgresProductExports(database, where)
      : undefined;

  return toProductExportsPage(rows, input, total);
}

export async function listPostgresProductExportParts(
  database: PostgresDatabase,
  exportId: string,
): Promise<ProductExportPartRecord[]> {
  return await database.db
    .select()
    .from(productExportParts)
    .where(eq(productExportParts.exportId, exportId))
    .orderBy(productExportParts.seq);
}

export async function listPostgresProductExportPartsByStatus(
  database: PostgresDatabase,
  input: { exportId: string; statuses: ProductExportPartStatus[] },
): Promise<ProductExportPartRecord[]> {
  if (input.statuses.length === 0) return [];

  return await database.db
    .select()
    .from(productExportParts)
    .where(
      and(
        eq(productExportParts.exportId, input.exportId),
        inArray(productExportParts.status, input.statuses),
      ),
    )
    .orderBy(productExportParts.seq);
}

export async function listPostgresRecoverableProductExports(
  database: PostgresDatabase,
  input: Parameters<ProductExportStore["listRecoverableExports"]>[0],
): Promise<ProductExportRecord[]> {
  return await database.db
    .select()
    .from(productExports)
    .where(getPostgresRecoverableWhere(input))
    .orderBy(asc(productExports.updatedAt), asc(productExports.id))
    .limit(input.limit);
}

export async function getPostgresProductExportPartStats(
  database: PostgresDatabase,
  exportId: string,
): Promise<ProductExportPartStats> {
  const rows = await database.db
    .select({
      status: productExportParts.status,
      total: sql<number>`count(*)`,
    })
    .from(productExportParts)
    .where(eq(productExportParts.exportId, exportId))
    .groupBy(productExportParts.status);

  return toPartStats(rows);
}

export async function markPostgresProductExportPartDone(
  database: PostgresDatabase,
  input: ProductExportPartLookup & {
    bucketKey: string;
    bucketProvider: string;
    byteSize: number;
    rowCount: number;
  },
): Promise<void> {
  const now = new Date();
  await database.db
    .update(productExportParts)
    .set({
      bucketKey: input.bucketKey,
      bucketProvider: input.bucketProvider,
      byteSize: input.byteSize,
      completedAt: now,
      errorCode: null,
      errorMessage: null,
      rowCount: input.rowCount,
      status: PRODUCT_EXPORT_PART_STATUSES.DONE,
      updatedAt: now,
    })
    .where(
      and(
        eq(productExportParts.exportId, input.exportId),
        eq(productExportParts.seq, input.seq),
      ),
    );
}

export async function markPostgresProductExportPartFailed(
  database: PostgresDatabase,
  input: ProductExportPartLookup & {
    errorCode: string;
    errorMessage: string;
  },
): Promise<void> {
  const now = new Date();
  await database.db
    .update(productExportParts)
    .set({
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      status: PRODUCT_EXPORT_PART_STATUSES.FAILED,
      updatedAt: now,
    })
    .where(
      and(
        eq(productExportParts.exportId, input.exportId),
        eq(productExportParts.seq, input.seq),
      ),
    );
}

export async function deletePostgresProductExport(
  database: PostgresDatabase,
  input: ProductExportLookup,
): Promise<void> {
  const now = new Date();

  await database.db
    .update(productExports)
    .set({
      deletedAt: now,
      status: PRODUCT_EXPORT_STATUSES.CANCELED,
      updatedAt: now,
    })
    .where(
      and(
        eq(productExports.id, input.id),
        eq(productExports.shopDomain, input.shopDomain),
      ),
    );
}

function getPostgresListWhere(
  input: ProductExportListInput,
  cursor: SeekCursor | null,
) {
  const conditions = [
    eq(productExports.shopDomain, input.shopDomain),
    isNull(productExports.deletedAt),
  ];

  if (input.status) {
    conditions.push(eq(productExports.status, input.status));
  }

  if (cursor) {
    conditions.push(
      or(
        lt(productExports.createdAt, cursor.createdAt),
        and(
          eq(productExports.createdAt, cursor.createdAt),
          lt(productExports.id, cursor.id),
        ),
      )!,
    );
  }

  return and(...conditions);
}

function getPostgresRecoverableWhere(
  input: Parameters<ProductExportStore["listRecoverableExports"]>[0],
) {
  const conditions = [
    isNull(productExports.deletedAt),
    ne(productExports.status, PRODUCT_EXPORT_STATUSES.READY),
    ne(productExports.status, PRODUCT_EXPORT_STATUSES.CANCELED),
    or(
      lt(productExports.updatedAt, input.olderThan),
      eq(productExports.status, PRODUCT_EXPORT_STATUSES.BULK_OPERATION_RUNNING),
      eq(
        productExports.status,
        PRODUCT_EXPORT_STATUSES.BULK_OPERATION_COMPLETED,
      ),
      eq(productExports.status, PRODUCT_EXPORT_STATUSES.GENERATING_CSV),
      eq(productExports.status, PRODUCT_EXPORT_STATUSES.REQUIRES_NODE_FINALIZE),
    )!,
  ];

  if (input.cursor) {
    conditions.push(
      or(
        gt(productExports.updatedAt, input.cursor.updatedAt),
        and(
          eq(productExports.updatedAt, input.cursor.updatedAt),
          gt(productExports.id, input.cursor.id),
        ),
      )!,
    );
  }

  return and(...conditions);
}

async function countPostgresProductExports(
  database: PostgresDatabase,
  where: ReturnType<typeof getPostgresListWhere>,
): Promise<number> {
  const [row] = await database.db
    .select({ total: sql<number>`count(*)` })
    .from(productExports)
    .where(where);

  return Number(row?.total ?? 0);
}
