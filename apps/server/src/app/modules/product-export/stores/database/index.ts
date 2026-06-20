import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import {
  claimPostgresProductExportPart,
  createPostgresProductExport,
  createPostgresProductExportParts,
  deletePostgresProductExport,
  findPostgresProductExportByBulkOperationId,
  findPostgresProductExportById,
  getPostgresProductExportPartStats,
  listPostgresProductExportParts,
  listPostgresProductExportPartsByStatus,
  listPostgresProductExportPartsPage,
  listPostgresProductExports,
  listPostgresRecoverableProductExports,
  markPostgresProductExportPartDone,
  markPostgresProductExportPartFailed,
  updatePostgresProductExport,
} from "./postgres";
import {
  claimSqliteProductExportPart,
  createSqliteProductExport,
  createSqliteProductExportParts,
  deleteSqliteProductExport,
  findSqliteProductExportByBulkOperationId,
  findSqliteProductExportById,
  getSqliteProductExportPartStats,
  listSqliteProductExportParts,
  listSqliteProductExportPartsByStatus,
  listSqliteProductExportPartsPage,
  listSqliteProductExports,
  listSqliteRecoverableProductExports,
  markSqliteProductExportPartDone,
  markSqliteProductExportPartFailed,
  updateSqliteProductExport,
} from "./sqlite";
import type {
  ProductExportPartRecord,
  ProductExportPartStats,
  ProductExportRecord,
  ProductExportsPage,
  ProductExportStore,
} from "../../types";
import type { Database } from "@/infra/database";

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

    async listPartsPage(input): Promise<ProductExportPartRecord[]> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return listSqliteProductExportPartsPage(database, input);
      }

      return listPostgresProductExportPartsPage(database, input);
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
        return listSqliteRecoverableProductExports(database, input);
      }

      return listPostgresRecoverableProductExports(database, input);
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
