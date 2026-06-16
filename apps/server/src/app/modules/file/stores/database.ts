import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import { files } from "@shamt/database/models/postgres";
import { sqliteFiles } from "@shamt/database/models/sqlite";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import type {
  FileListInput,
  FileLookup,
  FileRecord,
  FilesPage,
  FilesStore,
  FileStatusUpdate,
} from "../types";
import type {
  D1DatabaseClient,
  Database,
  PostgresDatabase,
} from "@/infra/database";

type FilesDatabase = Database;

/**
 * Creates a Drizzle-backed files store from an eager database client.
 */
export function createDatabaseFilesStore(db: FilesDatabase): FilesStore {
  return createDatabaseFilesStoreFromPromise(Promise.resolve(db));
}

/**
 * Creates a Drizzle-backed files store from a lazy database promise so runtime
 * capabilities can stay synchronous at registration time.
 *
 * Example:
 * - postgres provider uses @shamt/database/models/postgres files.
 * - d1 provider uses @shamt/database/models/sqlite sqliteFiles.
 */
export function createDatabaseFilesStoreFromPromise(
  dbPromise: Promise<FilesDatabase>,
): FilesStore {
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

/**
 * Upserts one file metadata row through the PostgreSQL files table.
 */
async function createPostgresFile(
  database: PostgresDatabase,
  file: FileRecord,
): Promise<void> {
  await database.db.insert(files).values(file).onConflictDoUpdate({
    target: files.id,
    set: file,
  });
}

/**
 * Upserts one file metadata row through the SQLite/D1 files table.
 */
async function createSqliteFile(
  database: D1DatabaseClient,
  file: FileRecord,
): Promise<void> {
  await database.db.insert(sqliteFiles).values(file).onConflictDoUpdate({
    target: sqliteFiles.id,
    set: file,
  });
}

/**
 * Finds a PostgreSQL file row by id and shop domain.
 */
async function findPostgresFileById(
  database: PostgresDatabase,
  input: FileLookup,
): Promise<FileRecord | null> {
  const [file] = await database.db
    .select()
    .from(files)
    .where(and(eq(files.id, input.id), eq(files.shopDomain, input.shopDomain)))
    .limit(1);

  return file ?? null;
}

/**
 * Finds a SQLite/D1 file row by id and shop domain.
 */
async function findSqliteFileById(
  database: D1DatabaseClient,
  input: FileLookup,
): Promise<FileRecord | null> {
  const [file] = await database.db
    .select()
    .from(sqliteFiles)
    .where(
      and(
        eq(sqliteFiles.id, input.id),
        eq(sqliteFiles.shopDomain, input.shopDomain),
      ),
    )
    .limit(1);

  return file ?? null;
}

/**
 * Lists active PostgreSQL files using one extra row to detect nextCursor.
 */
async function listPostgresFiles(
  database: PostgresDatabase,
  input: FileListInput,
): Promise<FilesPage> {
  const rows: FileRecord[] = await database.db
    .select()
    .from(files)
    .where(
      and(
        eq(files.shopDomain, input.shopDomain),
        isNull(files.deletedAt),
        ne(files.status, "deleted"),
        ne(files.status, "failed"),
      ),
    )
    .orderBy(desc(files.createdAt))
    .limit(input.limit + 1);

  return toFilesPage(rows, input);
}

/**
 * Lists active SQLite/D1 files using one extra row to detect nextCursor.
 */
async function listSqliteFiles(
  database: D1DatabaseClient,
  input: FileListInput,
): Promise<FilesPage> {
  const rows: FileRecord[] = await database.db
    .select()
    .from(sqliteFiles)
    .where(
      and(
        eq(sqliteFiles.shopDomain, input.shopDomain),
        isNull(sqliteFiles.deletedAt),
        ne(sqliteFiles.status, "deleted"),
        ne(sqliteFiles.status, "failed"),
      ),
    )
    .orderBy(desc(sqliteFiles.createdAt))
    .limit(input.limit + 1);

  return toFilesPage(rows, input);
}

/**
 * Updates PostgreSQL file status fields without touching immutable metadata.
 */
async function updatePostgresFileStatus(
  database: PostgresDatabase,
  input: FileStatusUpdate,
): Promise<void> {
  await database.db
    .update(files)
    .set({
      deletedAt: input.deletedAt,
      status: input.status,
      updatedAt: new Date(),
    })
    .where(and(eq(files.id, input.id), eq(files.shopDomain, input.shopDomain)));
}

/**
 * Updates SQLite/D1 file status fields without touching immutable metadata.
 */
async function updateSqliteFileStatus(
  database: D1DatabaseClient,
  input: FileStatusUpdate,
): Promise<void> {
  await database.db
    .update(sqliteFiles)
    .set({
      deletedAt: input.deletedAt,
      status: input.status,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sqliteFiles.id, input.id),
        eq(sqliteFiles.shopDomain, input.shopDomain),
      ),
    );
}

/**
 * Soft-deletes a PostgreSQL file metadata row.
 */
async function deletePostgresFile(
  database: PostgresDatabase,
  input: FileLookup,
): Promise<void> {
  const now = new Date();

  await database.db
    .update(files)
    .set({
      deletedAt: now,
      status: "deleted",
      updatedAt: now,
    })
    .where(and(eq(files.id, input.id), eq(files.shopDomain, input.shopDomain)));
}

/**
 * Soft-deletes a SQLite/D1 file metadata row.
 */
async function deleteSqliteFile(
  database: D1DatabaseClient,
  input: FileLookup,
): Promise<void> {
  const now = new Date();

  await database.db
    .update(sqliteFiles)
    .set({
      deletedAt: now,
      status: "deleted",
      updatedAt: now,
    })
    .where(
      and(
        eq(sqliteFiles.id, input.id),
        eq(sqliteFiles.shopDomain, input.shopDomain),
      ),
    );
}

/**
 * Creates an in-memory cursor page from the limit-plus-one query result.
 */
function toFilesPage(rows: FileRecord[], input: FileListInput): FilesPage {
  const start = input.cursor
    ? Math.max(rows.findIndex((file) => file.id === input.cursor) + 1, 0)
    : 0;
  const page = rows.slice(start, start + input.limit);
  const next = rows[start + input.limit];

  return {
    files: page,
    nextCursor: next?.id,
  };
}
