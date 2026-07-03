import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import type {
  ProductExportPartRecord,
  ProductExportPartStats,
  ProductExportRecord,
  ProductExportRepository,
  ProductExportsPage,
} from "../../types";
import type { Database } from "@/infra/database";

type ProductExportsDatabase = Database;

export function createDatabaseProductExportsRepository(
  db: ProductExportsDatabase,
): ProductExportRepository {
  return createDatabaseProductExportsRepositoryFromPromise(Promise.resolve(db));
}

export function createDatabaseProductExportsRepositoryFromPromise(
  dbPromise: Promise<ProductExportsDatabase>,
): ProductExportRepository {
  return {
    async create(record): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { createSqliteProductExport } = await import("./sqlite");
        return createSqliteProductExport(database, record);
      }

      const { createPostgresProductExport } = await import("./postgres");
      return createPostgresProductExport(database, record);
    },

    async createParts(parts): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { createSqliteProductExportParts } = await import("./sqlite");
        return createSqliteProductExportParts(database, parts);
      }

      const { createPostgresProductExportParts } = await import("./postgres");
      return createPostgresProductExportParts(database, parts);
    },

    async claimPart(input): Promise<ProductExportPartRecord | null> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { claimSqliteProductExportPart } = await import("./sqlite");
        return claimSqliteProductExportPart(database, input);
      }

      const { claimPostgresProductExportPart } = await import("./postgres");
      return claimPostgresProductExportPart(database, input);
    },

    async delete(input): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { deleteSqliteProductExport } = await import("./sqlite");
        return deleteSqliteProductExport(database, input);
      }

      const { deletePostgresProductExport } = await import("./postgres");
      return deletePostgresProductExport(database, input);
    },

    async findByBulkOperationId(
      bulkOperationId,
    ): Promise<ProductExportRecord | null> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { findSqliteProductExportByBulkOperationId } =
          await import("./sqlite");
        return findSqliteProductExportByBulkOperationId(
          database,
          bulkOperationId,
        );
      }

      const { findPostgresProductExportByBulkOperationId } =
        await import("./postgres");
      return findPostgresProductExportByBulkOperationId(
        database,
        bulkOperationId,
      );
    },

    async findById(input): Promise<ProductExportRecord | null> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { findSqliteProductExportById } = await import("./sqlite");
        return findSqliteProductExportById(database, input);
      }

      const { findPostgresProductExportById } = await import("./postgres");
      return findPostgresProductExportById(database, input);
    },

    async list(input): Promise<ProductExportsPage> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { listSqliteProductExports } = await import("./sqlite");
        return listSqliteProductExports(database, input);
      }

      const { listPostgresProductExports } = await import("./postgres");
      return listPostgresProductExports(database, input);
    },

    async getPartStats(exportId): Promise<ProductExportPartStats> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { getSqliteProductExportPartStats } = await import("./sqlite");
        return getSqliteProductExportPartStats(database, exportId);
      }

      const { getPostgresProductExportPartStats } = await import("./postgres");
      return getPostgresProductExportPartStats(database, exportId);
    },

    async listParts(exportId): Promise<ProductExportPartRecord[]> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { listSqliteProductExportParts } = await import("./sqlite");
        return listSqliteProductExportParts(database, exportId);
      }

      const { listPostgresProductExportParts } = await import("./postgres");
      return listPostgresProductExportParts(database, exportId);
    },

    async listPartsPage(input): Promise<ProductExportPartRecord[]> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { listSqliteProductExportPartsPage } = await import("./sqlite");
        return listSqliteProductExportPartsPage(database, input);
      }

      const { listPostgresProductExportPartsPage } = await import("./postgres");
      return listPostgresProductExportPartsPage(database, input);
    },

    async listPartsByStatus(input): Promise<ProductExportPartRecord[]> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { listSqliteProductExportPartsByStatus } =
          await import("./sqlite");
        return listSqliteProductExportPartsByStatus(database, input);
      }

      const { listPostgresProductExportPartsByStatus } =
        await import("./postgres");
      return listPostgresProductExportPartsByStatus(database, input);
    },

    async listRecoverableExports(input): Promise<ProductExportRecord[]> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { listSqliteRecoverableProductExports } =
          await import("./sqlite");
        return listSqliteRecoverableProductExports(database, input);
      }

      const { listPostgresRecoverableProductExports } =
        await import("./postgres");
      return listPostgresRecoverableProductExports(database, input);
    },

    async markPartDone(input): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { markSqliteProductExportPartDone } = await import("./sqlite");
        return markSqliteProductExportPartDone(database, input);
      }

      const { markPostgresProductExportPartDone } = await import("./postgres");
      return markPostgresProductExportPartDone(database, input);
    },

    async markPartFailed(input): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { markSqliteProductExportPartFailed } = await import("./sqlite");
        return markSqliteProductExportPartFailed(database, input);
      }

      const { markPostgresProductExportPartFailed } =
        await import("./postgres");
      return markPostgresProductExportPartFailed(database, input);
    },

    async update(record): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { updateSqliteProductExport } = await import("./sqlite");
        return updateSqliteProductExport(database, record);
      }

      const { updatePostgresProductExport } = await import("./postgres");
      return updatePostgresProductExport(database, record);
    },
  };
}
