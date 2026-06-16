import { files, type SelectFile } from "@shamt/database";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import type { FileRecord, FilesPage, FilesStore } from "../domain/files";
import type { IsolateDatabase, ProcessDatabase } from "@/infra/database";

type FilesDatabase = ProcessDatabase | IsolateDatabase;

/**
 * Creates a Drizzle-backed files store from an eager database client.
 */
export function createDatabaseFilesStore(db: FilesDatabase): FilesStore {
  return createDatabaseFilesStoreFromPromise(Promise.resolve(db));
}

/**
 * Creates a Drizzle-backed files store from a lazy database promise so runtime
 * capabilities can stay synchronous at registration time.
 */
export function createDatabaseFilesStoreFromPromise(
  dbPromise: Promise<FilesDatabase>,
): FilesStore {
  return {
    async create(file): Promise<void> {
      const db = await dbPromise;
      await db
        .insert(files)
        .values(toDatabaseFile(file))
        .onConflictDoUpdate({
          target: files.id,
          set: toDatabaseFile(file),
        });
    },

    async findById(input): Promise<FileRecord | null> {
      const db = await dbPromise;
      const [file] = await db
        .select()
        .from(files)
        .where(
          and(eq(files.id, input.id), eq(files.shopDomain, input.shopDomain)),
        )
        .limit(1);

      return file ? fromDatabaseFile(file) : null;
    },

    async list(input): Promise<FilesPage> {
      const db = await dbPromise;
      const rows = await db
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
      const start = input.cursor
        ? Math.max(rows.findIndex((file) => file.id === input.cursor) + 1, 0)
        : 0;
      const page = rows.slice(start, start + input.limit);
      const next = rows[start + input.limit];

      return {
        files: page.map(fromDatabaseFile),
        nextCursor: next?.id,
      };
    },

    async updateStatus(input): Promise<void> {
      const db = await dbPromise;
      await db
        .update(files)
        .set({
          deletedAt: input.deletedAt,
          status: input.status,
          updatedAt: new Date(),
        })
        .where(
          and(eq(files.id, input.id), eq(files.shopDomain, input.shopDomain)),
        );
    },

    async delete(input): Promise<void> {
      const db = await dbPromise;
      const now = new Date();

      await db
        .update(files)
        .set({
          deletedAt: now,
          status: "deleted",
          updatedAt: now,
        })
        .where(
          and(eq(files.id, input.id), eq(files.shopDomain, input.shopDomain)),
        );
    },
  };
}

function toDatabaseFile(file: FileRecord): typeof files.$inferInsert {
  return {
    bucketKey: file.bucketKey,
    bucketProvider: file.bucketProvider,
    byteSize: file.byteSize,
    contentType: file.contentType,
    createdAt: file.createdAt,
    deletedAt: file.deletedAt,
    expiresAt: file.expiresAt,
    id: file.id,
    originalName: file.originalName,
    safeName: file.safeName,
    shopDomain: file.shopDomain,
    status: file.status,
    updatedAt: file.updatedAt,
  };
}

function fromDatabaseFile(file: SelectFile): FileRecord {
  return {
    bucketKey: file.bucketKey,
    bucketProvider: file.bucketProvider,
    byteSize: file.byteSize,
    contentType: file.contentType,
    createdAt: file.createdAt,
    deletedAt: file.deletedAt ?? undefined,
    expiresAt: file.expiresAt,
    id: file.id,
    originalName: file.originalName,
    safeName: file.safeName,
    shopDomain: file.shopDomain,
    status: file.status,
    updatedAt: file.updatedAt,
  };
}
