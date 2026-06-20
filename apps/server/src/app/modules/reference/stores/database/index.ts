import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import {
  createPostgresReference,
  deletePostgresReference,
  findPostgresReferenceByCode,
  findPostgresReferenceByCodeIncludingDeleted,
  findPostgresReferenceById,
  listPostgresReferences,
  updatePostgresReference,
} from "./postgres";
import {
  createSqliteReference,
  deleteSqliteReference,
  findSqliteReferenceByCode,
  findSqliteReferenceByCodeIncludingDeleted,
  findSqliteReferenceById,
  listSqliteReferences,
  updateSqliteReference,
} from "./sqlite";
import type { ReferenceStore } from "../../types";
import type { Database } from "@/infra/database";

export function createDatabaseReferenceStore(db: Database): ReferenceStore {
  return createDatabaseReferenceStoreFromPromise(Promise.resolve(db));
}

export function createDatabaseReferenceStoreFromPromise(
  dbPromise: Promise<Database>,
): ReferenceStore {
  return {
    async create(record): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return createSqliteReference(database, record);
      }

      return createPostgresReference(database, record);
    },

    async delete(input): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return deleteSqliteReference(database, input);
      }

      return deletePostgresReference(database, input);
    },

    async findByCode(input) {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return findSqliteReferenceByCode(database, input);
      }

      return findPostgresReferenceByCode(database, input);
    },

    async findByCodeIncludingDeleted(input) {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return findSqliteReferenceByCodeIncludingDeleted(database, input);
      }

      return findPostgresReferenceByCodeIncludingDeleted(database, input);
    },

    async findById(input) {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return findSqliteReferenceById(database, input);
      }

      return findPostgresReferenceById(database, input);
    },

    async list(input) {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return listSqliteReferences(database, input);
      }

      return listPostgresReferences(database, input);
    },

    async update(record): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return updateSqliteReference(database, record);
      }

      return updatePostgresReference(database, record);
    },
  };
}
