import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import type { ReferenceRepository } from "../../types";
import type { Database } from "@/infra/database";

export function createDatabaseReferenceRepository(
  db: Database,
): ReferenceRepository {
  return createDatabaseReferenceRepositoryFromPromise(Promise.resolve(db));
}

export function createDatabaseReferenceRepositoryFromPromise(
  dbPromise: Promise<Database>,
): ReferenceRepository {
  return {
    async create(record): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { createSqliteReference } = await import("./sqlite");
        return createSqliteReference(database, record);
      }

      const { createPostgresReference } = await import("./postgres");
      return createPostgresReference(database, record);
    },

    async delete(input): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { deleteSqliteReference } = await import("./sqlite");
        return deleteSqliteReference(database, input);
      }

      const { deletePostgresReference } = await import("./postgres");
      return deletePostgresReference(database, input);
    },

    async findByCode(input) {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { findSqliteReferenceByCode } = await import("./sqlite");
        return findSqliteReferenceByCode(database, input);
      }

      const { findPostgresReferenceByCode } = await import("./postgres");
      return findPostgresReferenceByCode(database, input);
    },

    async findByCodeIncludingDeleted(input) {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { findSqliteReferenceByCodeIncludingDeleted } =
          await import("./sqlite");
        return findSqliteReferenceByCodeIncludingDeleted(database, input);
      }

      const { findPostgresReferenceByCodeIncludingDeleted } =
        await import("./postgres");
      return findPostgresReferenceByCodeIncludingDeleted(database, input);
    },

    async findById(input) {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { findSqliteReferenceById } = await import("./sqlite");
        return findSqliteReferenceById(database, input);
      }

      const { findPostgresReferenceById } = await import("./postgres");
      return findPostgresReferenceById(database, input);
    },

    async list(input) {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { listSqliteReferences } = await import("./sqlite");
        return listSqliteReferences(database, input);
      }

      const { listPostgresReferences } = await import("./postgres");
      return listPostgresReferences(database, input);
    },

    async update(record): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { updateSqliteReference } = await import("./sqlite");
        return updateSqliteReference(database, record);
      }

      const { updatePostgresReference } = await import("./postgres");
      return updatePostgresReference(database, record);
    },
  };
}
