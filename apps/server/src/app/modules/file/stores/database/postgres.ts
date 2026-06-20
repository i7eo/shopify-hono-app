import { files } from "@shamt/database/models/postgres";
import { and, desc, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import { getListCursor, getPageOffset, toFilesPage } from "./shared";
import type {
  FileListInput,
  FileLookup,
  FileRecord,
  FilesPage,
  FileStatusUpdate,
} from "../../types";
import type { PostgresDatabase } from "@/infra/database";
import type { SeekCursor } from "@/shared/models";

/**
 * Upserts one file metadata row through the PostgreSQL files table.
 */
export async function createPostgresFile(
  database: PostgresDatabase,
  file: FileRecord,
): Promise<void> {
  await database.db.insert(files).values(file).onConflictDoUpdate({
    target: files.id,
    set: file,
  });
}

/**
 * Finds a PostgreSQL file row by id and shop domain.
 */
export async function findPostgresFileById(
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
 * Lists active PostgreSQL files using one extra row to detect nextCursor.
 */
export async function listPostgresFiles(
  database: PostgresDatabase,
  input: FileListInput,
): Promise<FilesPage> {
  const cursor = getListCursor(input);
  const where = getPostgresListWhere(input, cursor);
  const query = database.db
    .select()
    .from(files)
    .where(where)
    .orderBy(desc(files.createdAt), desc(files.id))
    .limit(input.pagination.limit + 1);

  const rows: FileRecord[] =
    input.pagination.mode === "page"
      ? await query.offset(getPageOffset(input.pagination))
      : await query;
  const total =
    input.pagination.mode === "page"
      ? await countPostgresFiles(database, where)
      : undefined;

  return toFilesPage(rows, input, total);
}

/**
 * Updates PostgreSQL file status fields without touching immutable metadata.
 */
export async function updatePostgresFileStatus(
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
 * Soft-deletes a PostgreSQL file metadata row.
 */
export async function deletePostgresFile(
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

async function countPostgresFiles(
  database: PostgresDatabase,
  where: ReturnType<typeof getPostgresListWhere>,
): Promise<number> {
  const [row] = await database.db
    .select({ total: sql<number>`count(*)` })
    .from(files)
    .where(where);

  return Number(row?.total ?? 0);
}

function getPostgresListWhere(input: FileListInput, cursor: SeekCursor | null) {
  const conditions = [
    eq(files.shopDomain, input.shopDomain),
    isNull(files.deletedAt),
    ne(files.status, "deleted"),
    ne(files.status, "failed"),
  ];

  if (cursor) {
    conditions.push(
      or(
        lt(files.createdAt, cursor.createdAt),
        and(eq(files.createdAt, cursor.createdAt), lt(files.id, cursor.id)),
      )!,
    );
  }

  return and(...conditions);
}
