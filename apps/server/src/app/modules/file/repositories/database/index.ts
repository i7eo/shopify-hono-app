import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import type { FileRecord, FilesPage, FilesRepository } from "../../types";
import type { Database } from "@/infra/database";

type FilesDatabase = Database;

/**
 * Creates a Drizzle-backed files repository from an eager database client.
 */
export function createDatabaseFilesRepository(
  db: FilesDatabase,
): FilesRepository {
  return createDatabaseFilesRepositoryFromPromise(Promise.resolve(db));
}

/**
 * Creates a Drizzle-backed files repository from a lazy database promise so runtime
 * capabilities can stay synchronous at registration time.
 */
export function createDatabaseFilesRepositoryFromPromise(
  dbPromise: Promise<FilesDatabase>,
): FilesRepository {
  return {
    async create(file): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { createSqliteFile } = await import("./sqlite");
        return createSqliteFile(database, file);
      }

      const { createPostgresFile } = await import("./postgres");
      return createPostgresFile(database, file);
    },

    async findById(input): Promise<FileRecord | null> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { findSqliteFileById } = await import("./sqlite");
        return findSqliteFileById(database, input);
      }

      const { findPostgresFileById } = await import("./postgres");
      return findPostgresFileById(database, input);
    },

    async list(input): Promise<FilesPage> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { listSqliteFiles } = await import("./sqlite");
        return listSqliteFiles(database, input);
      }

      const { listPostgresFiles } = await import("./postgres");
      return listPostgresFiles(database, input);
    },

    async updateStatus(input): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { updateSqliteFileStatus } = await import("./sqlite");
        return updateSqliteFileStatus(database, input);
      }

      const { updatePostgresFileStatus } = await import("./postgres");
      return updatePostgresFileStatus(database, input);
    },

    async delete(input): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        const { deleteSqliteFile } = await import("./sqlite");
        return deleteSqliteFile(database, input);
      }

      const { deletePostgresFile } = await import("./postgres");
      return deletePostgresFile(database, input);
    },
  };
}
