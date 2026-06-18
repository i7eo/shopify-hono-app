import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import {
  productExportParts,
  productExports,
} from "@shamt/database/models/postgres";
import {
  sqliteProductExportParts,
  sqliteProductExports,
} from "@shamt/database/models/sqlite";
import { and, desc, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import {
  PRODUCT_EXPORT_PART_STATUSES,
  PRODUCT_EXPORT_RETRYABLE_PART_STATUSES,
  PRODUCT_EXPORT_STATUSES,
} from "../utils";
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
} from "../types";
import type {
  D1DatabaseClient,
  Database,
  PostgresDatabase,
} from "@/infra/database";

type ProductExportsDatabase = Database;

export function createDatabaseProductExportsStore(
  db: ProductExportsDatabase,
): ProductExportStore {
  return createDatabaseProductExportsStoreFromPromise(Promise.resolve(db));
}

export function createDatabaseProductExportsStoreFromPromise(
  dbPromise: Promise<ProductExportsDatabase>,
): ProductExportStore {
  return {
    async create(record): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return createSqliteProductExport(database, record);
      }

      return createPostgresProductExport(database, record);
    },

    async createParts(parts): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return createSqliteProductExportParts(database, parts);
      }

      return createPostgresProductExportParts(database, parts);
    },

    async claimPart(input): Promise<ProductExportPartRecord | null> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return claimSqliteProductExportPart(database, input);
      }

      return claimPostgresProductExportPart(database, input);
    },

    async delete(input): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return deleteSqliteProductExport(database, input);
      }

      return deletePostgresProductExport(database, input);
    },

    async findByBulkOperationId(
      bulkOperationId,
    ): Promise<ProductExportRecord | null> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return findSqliteProductExportByBulkOperationId(
          database,
          bulkOperationId,
        );
      }

      return findPostgresProductExportByBulkOperationId(
        database,
        bulkOperationId,
      );
    },

    async findById(input): Promise<ProductExportRecord | null> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return findSqliteProductExportById(database, input);
      }

      return findPostgresProductExportById(database, input);
    },

    async list(input): Promise<ProductExportsPage> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return listSqliteProductExports(database, input);
      }

      return listPostgresProductExports(database, input);
    },

    async getPartStats(exportId): Promise<ProductExportPartStats> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return getSqliteProductExportPartStats(database, exportId);
      }

      return getPostgresProductExportPartStats(database, exportId);
    },

    async listParts(exportId): Promise<ProductExportPartRecord[]> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return listSqliteProductExportParts(database, exportId);
      }

      return listPostgresProductExportParts(database, exportId);
    },

    async listPartsByStatus(input): Promise<ProductExportPartRecord[]> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return listSqliteProductExportPartsByStatus(database, input);
      }

      return listPostgresProductExportPartsByStatus(database, input);
    },

    async listRecoverableExports(input): Promise<ProductExportRecord[]> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return listSqliteRecoverableProductExports(database, input.olderThan);
      }

      return listPostgresRecoverableProductExports(database, input.olderThan);
    },

    async markPartDone(input): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return markSqliteProductExportPartDone(database, input);
      }

      return markPostgresProductExportPartDone(database, input);
    },

    async markPartFailed(input): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return markSqliteProductExportPartFailed(database, input);
      }

      return markPostgresProductExportPartFailed(database, input);
    },

    async update(record): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return updateSqliteProductExport(database, record);
      }

      return updatePostgresProductExport(database, record);
    },
  };
}

async function createPostgresProductExportParts(
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

async function createSqliteProductExportParts(
  database: D1DatabaseClient,
  parts: ProductExportPartRecord[],
): Promise<void> {
  if (parts.length === 0) return;

  await database.db
    .insert(sqliteProductExportParts)
    .values(parts)
    .onConflictDoNothing({
      target: [sqliteProductExportParts.exportId, sqliteProductExportParts.seq],
    });
}

async function createPostgresProductExport(
  database: PostgresDatabase,
  record: ProductExportRecord,
): Promise<void> {
  await database.db.insert(productExports).values(record).onConflictDoUpdate({
    target: productExports.id,
    set: record,
  });
}

async function createSqliteProductExport(
  database: D1DatabaseClient,
  record: ProductExportRecord,
): Promise<void> {
  await database.db
    .insert(sqliteProductExports)
    .values(record)
    .onConflictDoUpdate({
      target: sqliteProductExports.id,
      set: record,
    });
}

async function updatePostgresProductExport(
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

async function updateSqliteProductExport(
  database: D1DatabaseClient,
  record: ProductExportRecord,
): Promise<void> {
  await database.db
    .update(sqliteProductExports)
    .set(record)
    .where(
      and(
        eq(sqliteProductExports.id, record.id),
        eq(sqliteProductExports.shopDomain, record.shopDomain),
      ),
    );
}

async function findPostgresProductExportById(
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

async function findSqliteProductExportById(
  database: D1DatabaseClient,
  input: ProductExportLookup,
): Promise<ProductExportRecord | null> {
  const [record] = await database.db
    .select()
    .from(sqliteProductExports)
    .where(
      and(
        eq(sqliteProductExports.id, input.id),
        eq(sqliteProductExports.shopDomain, input.shopDomain),
        isNull(sqliteProductExports.deletedAt),
      ),
    )
    .limit(1);

  return record ?? null;
}

async function findPostgresProductExportByBulkOperationId(
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

async function findSqliteProductExportByBulkOperationId(
  database: D1DatabaseClient,
  bulkOperationId: string,
): Promise<ProductExportRecord | null> {
  const [record] = await database.db
    .select()
    .from(sqliteProductExports)
    .where(eq(sqliteProductExports.shopifyBulkOperationId, bulkOperationId))
    .limit(1);

  return record ?? null;
}

async function claimPostgresProductExportPart(
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

async function claimSqliteProductExportPart(
  database: D1DatabaseClient,
  input: ProductExportPartLookup,
): Promise<ProductExportPartRecord | null> {
  const now = new Date();
  const [record] = await database.db
    .update(sqliteProductExportParts)
    .set({
      attempts: sql`${sqliteProductExportParts.attempts} + 1`,
      errorCode: null,
      errorMessage: null,
      lockedAt: now,
      status: PRODUCT_EXPORT_PART_STATUSES.PROCESSING,
      updatedAt: now,
    })
    .where(
      and(
        eq(sqliteProductExportParts.exportId, input.exportId),
        eq(sqliteProductExportParts.seq, input.seq),
        inArray(sqliteProductExportParts.status, [
          ...PRODUCT_EXPORT_RETRYABLE_PART_STATUSES,
        ]),
      ),
    )
    .returning();

  return record ?? null;
}

async function listPostgresProductExports(
  database: PostgresDatabase,
  input: ProductExportListInput,
): Promise<ProductExportsPage> {
  const rows = await database.db
    .select()
    .from(productExports)
    .where(getPostgresListWhere(input))
    .orderBy(desc(productExports.createdAt))
    .limit(input.limit + 1);

  return toProductExportsPage(rows, input);
}

async function listSqliteProductExports(
  database: D1DatabaseClient,
  input: ProductExportListInput,
): Promise<ProductExportsPage> {
  const rows = await database.db
    .select()
    .from(sqliteProductExports)
    .where(getSqliteListWhere(input))
    .orderBy(desc(sqliteProductExports.createdAt))
    .limit(input.limit + 1);

  return toProductExportsPage(rows, input);
}

async function listPostgresProductExportParts(
  database: PostgresDatabase,
  exportId: string,
): Promise<ProductExportPartRecord[]> {
  return await database.db
    .select()
    .from(productExportParts)
    .where(eq(productExportParts.exportId, exportId))
    .orderBy(productExportParts.seq);
}

async function listSqliteProductExportParts(
  database: D1DatabaseClient,
  exportId: string,
): Promise<ProductExportPartRecord[]> {
  return await database.db
    .select()
    .from(sqliteProductExportParts)
    .where(eq(sqliteProductExportParts.exportId, exportId))
    .orderBy(sqliteProductExportParts.seq);
}

async function listPostgresProductExportPartsByStatus(
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

async function listSqliteProductExportPartsByStatus(
  database: D1DatabaseClient,
  input: { exportId: string; statuses: ProductExportPartStatus[] },
): Promise<ProductExportPartRecord[]> {
  if (input.statuses.length === 0) return [];

  return await database.db
    .select()
    .from(sqliteProductExportParts)
    .where(
      and(
        eq(sqliteProductExportParts.exportId, input.exportId),
        inArray(sqliteProductExportParts.status, input.statuses),
      ),
    )
    .orderBy(sqliteProductExportParts.seq);
}

async function listPostgresRecoverableProductExports(
  database: PostgresDatabase,
  olderThan: Date,
): Promise<ProductExportRecord[]> {
  return await database.db
    .select()
    .from(productExports)
    .where(
      and(
        isNull(productExports.deletedAt),
        ne(productExports.status, PRODUCT_EXPORT_STATUSES.READY),
        ne(productExports.status, PRODUCT_EXPORT_STATUSES.CANCELED),
        or(
          lt(productExports.updatedAt, olderThan),
          eq(
            productExports.status,
            PRODUCT_EXPORT_STATUSES.BULK_OPERATION_RUNNING,
          ),
          eq(
            productExports.status,
            PRODUCT_EXPORT_STATUSES.BULK_OPERATION_COMPLETED,
          ),
          eq(productExports.status, PRODUCT_EXPORT_STATUSES.GENERATING_CSV),
          eq(
            productExports.status,
            PRODUCT_EXPORT_STATUSES.REQUIRES_NODE_FINALIZE,
          ),
        ),
      ),
    );
}

async function listSqliteRecoverableProductExports(
  database: D1DatabaseClient,
  olderThan: Date,
): Promise<ProductExportRecord[]> {
  return await database.db
    .select()
    .from(sqliteProductExports)
    .where(
      and(
        isNull(sqliteProductExports.deletedAt),
        ne(sqliteProductExports.status, PRODUCT_EXPORT_STATUSES.READY),
        ne(sqliteProductExports.status, PRODUCT_EXPORT_STATUSES.CANCELED),
        or(
          lt(sqliteProductExports.updatedAt, olderThan),
          eq(
            sqliteProductExports.status,
            PRODUCT_EXPORT_STATUSES.BULK_OPERATION_RUNNING,
          ),
          eq(
            sqliteProductExports.status,
            PRODUCT_EXPORT_STATUSES.BULK_OPERATION_COMPLETED,
          ),
          eq(
            sqliteProductExports.status,
            PRODUCT_EXPORT_STATUSES.GENERATING_CSV,
          ),
          eq(
            sqliteProductExports.status,
            PRODUCT_EXPORT_STATUSES.REQUIRES_NODE_FINALIZE,
          ),
        ),
      ),
    );
}

async function getPostgresProductExportPartStats(
  database: PostgresDatabase,
  exportId: string,
): Promise<ProductExportPartStats> {
  return toPartStats(
    await database.db
      .select()
      .from(productExportParts)
      .where(eq(productExportParts.exportId, exportId)),
  );
}

async function getSqliteProductExportPartStats(
  database: D1DatabaseClient,
  exportId: string,
): Promise<ProductExportPartStats> {
  return toPartStats(
    await database.db
      .select()
      .from(sqliteProductExportParts)
      .where(eq(sqliteProductExportParts.exportId, exportId)),
  );
}

async function markPostgresProductExportPartDone(
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

async function markSqliteProductExportPartDone(
  database: D1DatabaseClient,
  input: ProductExportPartLookup & {
    bucketKey: string;
    bucketProvider: string;
    byteSize: number;
    rowCount: number;
  },
): Promise<void> {
  const now = new Date();
  await database.db
    .update(sqliteProductExportParts)
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
        eq(sqliteProductExportParts.exportId, input.exportId),
        eq(sqliteProductExportParts.seq, input.seq),
      ),
    );
}

async function markPostgresProductExportPartFailed(
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

async function markSqliteProductExportPartFailed(
  database: D1DatabaseClient,
  input: ProductExportPartLookup & {
    errorCode: string;
    errorMessage: string;
  },
): Promise<void> {
  const now = new Date();
  await database.db
    .update(sqliteProductExportParts)
    .set({
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      status: PRODUCT_EXPORT_PART_STATUSES.FAILED,
      updatedAt: now,
    })
    .where(
      and(
        eq(sqliteProductExportParts.exportId, input.exportId),
        eq(sqliteProductExportParts.seq, input.seq),
      ),
    );
}

async function deletePostgresProductExport(
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

async function deleteSqliteProductExport(
  database: D1DatabaseClient,
  input: ProductExportLookup,
): Promise<void> {
  const now = new Date();

  await database.db
    .update(sqliteProductExports)
    .set({
      deletedAt: now,
      status: PRODUCT_EXPORT_STATUSES.CANCELED,
      updatedAt: now,
    })
    .where(
      and(
        eq(sqliteProductExports.id, input.id),
        eq(sqliteProductExports.shopDomain, input.shopDomain),
      ),
    );
}

function getPostgresListWhere(input: ProductExportListInput) {
  const conditions = [
    eq(productExports.shopDomain, input.shopDomain),
    isNull(productExports.deletedAt),
  ];

  if (input.status) {
    conditions.push(eq(productExports.status, input.status));
  }

  return and(...conditions);
}

function getSqliteListWhere(input: ProductExportListInput) {
  const conditions = [
    eq(sqliteProductExports.shopDomain, input.shopDomain),
    isNull(sqliteProductExports.deletedAt),
  ];

  if (input.status) {
    conditions.push(eq(sqliteProductExports.status, input.status));
  }

  return and(...conditions);
}

function toProductExportsPage(
  rows: ProductExportRecord[],
  input: ProductExportListInput,
): ProductExportsPage {
  const productExports = rows.slice(0, input.limit);
  const next = rows.length > input.limit ? productExports.at(-1) : undefined;

  return {
    nextCursor: next?.id,
    productExports,
  };
}

function toPartStats(parts: Array<Pick<ProductExportPartRecord, "status">>) {
  const stats: ProductExportPartStats = {
    done: 0,
    failed: 0,
    pending: 0,
    processing: 0,
    total: parts.length,
  };

  for (const part of parts) {
    stats[part.status] += 1;
  }

  return stats;
}
