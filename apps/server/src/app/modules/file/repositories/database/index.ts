import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import {
  createPostgresFile,
  deletePostgresFile,
  findPostgresFileById,
  listPostgresFiles,
  updatePostgresFileStatus,
} from "./postgres";
import {
  createSqliteFile,
  deleteSqliteFile,
  findSqliteFileById,
  listSqliteFiles,
  updateSqliteFileStatus,
} from "./sqlite";
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
        return createSqliteFile(database, file);
      }

      return createPostgresFile(database, file);
    },

    async findById(input): Promise<FileRecord | null> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return findSqliteFileById(database, input);
      }

      return findPostgresFileById(database, input);
    },

    async list(input): Promise<FilesPage> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return listSqliteFiles(database, input);
      }

      return listPostgresFiles(database, input);
    },

    async updateStatus(input): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return updateSqliteFileStatus(database, input);
      }

      return updatePostgresFileStatus(database, input);
    },

    async delete(input): Promise<void> {
      const database = await dbPromise;

      if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
        return deleteSqliteFile(database, input);
      }

      return deletePostgresFile(database, input);
    },
  };
}
