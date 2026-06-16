import { afterEach, describe, expect, it, vi } from "vitest";
import { BucketFileDownloadResolver } from "@/app/modules/file/download";
import {
  createFile,
  createFiles,
  deleteFile,
  downloadFile,
  getFile,
} from "@/app/modules/file/service";
import { createDatabaseFilesStore } from "@/app/modules/file/stores/database";
import {
  disposeRuntimeCapabilities,
  setRuntimeCapability,
} from "@/app/runtime/capabilities";
import { DEFAULT_SIGNED_DOWNLOAD_URL_EXPIRE } from "@/constants";
import { runtimeConfig } from "./shopify/test-utils";
import type {
  FileDownloadResolver,
  FileRecord,
  FilesStore,
} from "@/app/modules/file/types";
import type {
  Bucket,
  BucketDownloadSigner,
  BucketReadableObject,
  BucketStoredObject,
} from "@/infra/bucket";
import type { Database } from "@/infra/database";

describe("file service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    return disposeRuntimeCapabilities();
  });

  it("creates, downloads, and deletes a file through runtime capabilities", async () => {
    const store = createMemoryMetadataStore();
    const bucket = createMemoryBucket();
    const resolver: FileDownloadResolver = {
      resolve: vi.fn(async ({ file }) => ({
        type: "stream" as const,
        body: (await bucket.open({ key: file.bucketKey })).body,
        headers: {
          "Content-Type": file.contentType,
        },
      })),
    };
    const c = createServiceContext({ bucket, resolver, store });

    const created = await createFile(c, {
      body: streamFromText("hello"),
      contentType: "text/plain",
      originalName: "import-report-2026-06-03-112151.csv",
      runtimeEnv: runtimeConfig,
      shopDomain: "test-shop.myshopify.com",
    });

    expect(created).toMatchObject({
      byteSize: 5,
      contentType: "text/plain",
      originalName: "import-report-2026-06-03-112151.csv",
      safeName: "import-report.csv",
      status: "available",
    });

    const metadata = await getFile(c, "test-shop.myshopify.com", created.id);
    expect(metadata.id).toBe(created.id);

    const download = await downloadFile(
      c,
      "test-shop.myshopify.com",
      created.id,
    );
    expect(download.type).toBe("stream");
    expect(resolver.resolve).toHaveBeenCalledTimes(1);

    await deleteFile(c, "test-shop.myshopify.com", created.id);
    await expect(
      getFile(c, "test-shop.myshopify.com", created.id),
    ).rejects.toMatchObject({
      status: 404,
      message: "File not found",
    });
  });

  it("returns a signed redirect for R2 downloads", async () => {
    const store = createMemoryMetadataStore();
    const signer: BucketDownloadSigner = {
      signDownloadUrl: vi.fn(
        async () =>
          await Promise.resolve("https://signed.example.com/file.csv"),
      ),
    };
    const c = createServiceContext({
      resolver: new BucketFileDownloadResolver(createMemoryBucket(), signer),
      store,
    });
    const file: FileRecord = {
      id: "file_r2",
      shopDomain: "test-shop.myshopify.com",
      originalName: "file.csv",
      safeName: "file.csv",
      contentType: "text/csv",
      byteSize: 5,
      bucketProvider: "r2",
      bucketKey: "test-shop/file.csv",
      status: "available",
      expiresAt: new Date(Date.now() + 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    await store.create(file);

    const download = await downloadFile(c, "test-shop.myshopify.com", file.id);

    expect(download).toEqual({
      type: "redirect",
      url: "https://signed.example.com/file.csv",
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
    expect(signer.signDownloadUrl).toHaveBeenCalledWith({
      contentType: "text/csv",
      expiresInMilliseconds: DEFAULT_SIGNED_DOWNLOAD_URL_EXPIRE,
      key: "test-shop/file.csv",
      originalName: "file.csv",
    });
  });

  it("marks expired files unavailable during read", async () => {
    const store = createMemoryMetadataStore();
    const c = createServiceContext({ store });
    const expired: FileRecord = {
      id: "file_expired",
      shopDomain: "test-shop.myshopify.com",
      originalName: "expired.txt",
      safeName: "expired.txt",
      contentType: "text/plain",
      byteSize: 7,
      bucketProvider: "memory",
      bucketKey: "test-shop.myshopify.com/expired.txt",
      status: "available",
      expiresAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    await store.create(expired);

    await expect(
      getFile(c, "test-shop.myshopify.com", expired.id),
    ).rejects.toMatchObject({
      status: 410,
      message: "File expired",
    });
    await expect(
      getFile(c, "test-shop.myshopify.com", expired.id),
    ).rejects.toMatchObject({
      status: 404,
      message: "File not found",
    });
  });

  it("marks upload failures as failed", async () => {
    const store = createMemoryMetadataStore();
    const bucket = createMemoryBucket({
      put: () => {
        throw new Error("write failed");
      },
    });
    const c = createServiceContext({ bucket, store });

    await expect(
      createFile(c, {
        body: streamFromText("hello"),
        contentType: "text/plain",
        originalName: "hello.txt",
        runtimeEnv: runtimeConfig,
        shopDomain: "test-shop.myshopify.com",
      }),
    ).rejects.toThrow("write failed");

    const page = await store.list({
      limit: 10,
      shopDomain: "test-shop.myshopify.com",
    });
    expect(page.files).toEqual([]);
  });

  it("creates multiple files sequentially", async () => {
    const store = createMemoryMetadataStore();
    const c = createServiceContext({ store });
    //@ts-ignore
    c.req = createRequestContext([
      ["files", new File(["hello"], "hello.txt", { type: "text/plain" })],
      ["files[]", new File(["world"], "world.txt", { type: "text/plain" })],
    ]);

    const result = await createFiles(c, {
      runtimeEnv: runtimeConfig,
      shopDomain: "test-shop.myshopify.com",
    });

    expect(result.files).toHaveLength(2);
    expect(result.files.map((file) => file.originalName)).toEqual([
      "hello.txt",
      "world.txt",
    ]);
    expect(result.files.every((file) => file.status === "available")).toBe(
      true,
    );

    const page = await store.list({
      limit: 10,
      shopDomain: "test-shop.myshopify.com",
    });
    const directories = new Set(
      page.files.map((file) =>
        file.bucketKey.split("/").slice(0, -1).join("/"),
      ),
    );
    expect(directories.size).toBe(1);
  });

  it("rejects empty multi-file uploads", async () => {
    const c = createServiceContext({});
    //@ts-ignore
    c.req = createRequestContext([]);

    await expect(
      createFiles(c, {
        runtimeEnv: runtimeConfig,
        shopDomain: "test-shop.myshopify.com",
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "At least one file is required",
    });
  });
});

function createServiceContext(options: {
  resolver?: FileDownloadResolver;
  bucket?: Bucket;
  database?: Database;
  store?: TestFilesStore;
}) {
  const database =
    options.database ?? options.store?.database ?? createMemoryFilesDatabase();
  const bucket = options.bucket ?? createMemoryBucket();
  const resolver =
    options.resolver ??
    ({
      resolve: vi.fn(() =>
        Promise.resolve({
          type: "redirect",
          url: "https://files.example.com/file",
        } as const),
      ),
    } satisfies FileDownloadResolver);

  setRuntimeCapability("databaseFactory", () => database);
  setRuntimeCapability("bucketFactory", () => bucket);
  setRuntimeCapability("moduleFileDownloadResolverFactory", () => resolver);
  setRuntimeCapability("moduleFileTaskDispatcherFactory", () => ({
    dispatch: vi.fn(() => Promise.resolve()),
  }));

  const context: Pick<Parameters<typeof createFile>[0], "get"> = {
    get: (key: string) => {
      if (key === "runtimeEnv") return runtimeConfig;
      if (key === "requestId") return "req_test";
      return;
    },
  };

  return context as Parameters<typeof createFile>[0];
}

type TestFilesStore = FilesStore & {
  database: Database;
};

function createMemoryMetadataStore(): TestFilesStore {
  const database = createMemoryFilesDatabase();
  const store = createDatabaseFilesStore(database);

  return Object.assign(store, { database });
}

function createMemoryFilesDatabase(): Database {
  const rows = new Map<string, FileRecord>();

  return {
    insert: () => ({
      values: (value: FileRecord) => ({
        onConflictDoUpdate: () => {
          rows.set(value.id, cloneFile(value));
          return Promise.resolve();
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          const predicates = collectSqlPredicates(condition);
          const selectRows = (ordered: boolean, limit: number) => {
            const files = [...rows.values()]
              .filter((file) => matchesSqlPredicates(file, predicates))
              .toSorted((a, b) =>
                ordered ? b.createdAt.getTime() - a.createdAt.getTime() : 0,
              )
              .slice(0, limit)
              .map(cloneFile);

            return Promise.resolve(files);
          };

          return {
            limit: (limit: number) => selectRows(false, limit),
            orderBy: () => ({
              limit: (limit: number) => selectRows(true, limit),
            }),
          };
        },
      }),
    }),
    update: () => ({
      set: (value: Partial<FileRecord>) => ({
        where: (condition: unknown) => {
          const predicates = collectSqlPredicates(condition);

          for (const file of rows.values()) {
            if (!matchesSqlPredicates(file, predicates)) continue;

            rows.set(file.id, {
              ...file,
              ...value,
              deletedAt: value.deletedAt ?? file.deletedAt,
            });
          }

          return Promise.resolve();
        },
      }),
    }),
  } as unknown as Database;
}

function cloneFile(file: FileRecord): FileRecord {
  return {
    ...file,
    createdAt: new Date(file.createdAt),
    deletedAt: file.deletedAt ? new Date(file.deletedAt) : null,
    expiresAt: new Date(file.expiresAt),
    updatedAt: new Date(file.updatedAt),
  };
}

function createMemoryBucket(overrides: Partial<Bucket> = {}): Bucket {
  const objects = new Map<string, Uint8Array>();

  return {
    async put(input): Promise<BucketStoredObject> {
      const bytes = await readAllBytes(input.body);
      objects.set(input.key, bytes);
      return {
        byteSize: bytes.byteLength,
        key: input.key,
        provider: "memory",
      };
    },
    open(input): Promise<BucketReadableObject> {
      const bytes = objects.get(input.key) ?? new Uint8Array();
      return Promise.resolve({
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
        byteSize: bytes.byteLength,
      });
    },
    delete(input) {
      objects.delete(input.key);
      return Promise.resolve();
    },
    ...overrides,
  };
}

function streamFromText(value: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });
}

function createRequestContext(entries: [string, File][]) {
  const formData = new FormData();

  for (const [key, value] of entries) {
    formData.append(key, value);
  }

  const request = new Request("https://example.test/api/files", {
    method: "POST",
    body: formData,
  });

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    raw: request,
  } as Parameters<typeof createFile>[0]["req"];
}

type SqlPredicate =
  | {
      field: keyof FileRecord;
      operator: "=" | "<>";
      value: unknown;
    }
  | {
      field: keyof FileRecord;
      operator: "is null";
    };

function collectSqlPredicates(value: unknown): SqlPredicate[] {
  if (!isSqlLike(value)) return [];

  const chunks = value.queryChunks;
  const simplePredicate = toSimpleSqlPredicate(chunks);
  if (simplePredicate) return [simplePredicate];

  return chunks.flatMap(collectSqlPredicates);
}

function toSimpleSqlPredicate(chunks: unknown[]): SqlPredicate | undefined {
  const field = toFileRecordField(chunks[1]);
  const operator = toSqlOperator(chunks[2]);

  if (!field || !operator) return undefined;

  if (operator === "is null") {
    return { field, operator };
  }

  return {
    field,
    operator,
    value: isSqlParam(chunks[3]) ? chunks[3].value : undefined,
  };
}

function matchesSqlPredicates(
  file: FileRecord,
  predicates: SqlPredicate[],
): boolean {
  return predicates.every((predicate) => {
    if (predicate.operator === "is null") {
      return (
        file[predicate.field] === null || file[predicate.field] === undefined
      );
    }

    if (predicate.operator === "=") {
      return file[predicate.field] === predicate.value;
    }

    return file[predicate.field] !== predicate.value;
  });
}

function toFileRecordField(value: unknown): keyof FileRecord | undefined {
  if (!isColumnLike(value)) return undefined;

  const fieldByColumnName = {
    bucket_key: "bucketKey",
    bucket_provider: "bucketProvider",
    byte_size: "byteSize",
    content_type: "contentType",
    created_at: "createdAt",
    deleted_at: "deletedAt",
    expires_at: "expiresAt",
    id: "id",
    original_name: "originalName",
    safe_name: "safeName",
    shop_domain: "shopDomain",
    status: "status",
    updated_at: "updatedAt",
  } satisfies Record<string, keyof FileRecord>;

  return fieldByColumnName[value.name as keyof typeof fieldByColumnName];
}

function toSqlOperator(value: unknown): SqlPredicate["operator"] | undefined {
  if (!isStringChunkLike(value)) return undefined;

  const text = value.value.join("").trim().toLowerCase();
  if (text === "=" || text === "<>" || text === "is null") return text;
  return undefined;
}

function isSqlLike(value: unknown): value is { queryChunks: unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "queryChunks" in value &&
    Array.isArray(value.queryChunks)
  );
}

function isColumnLike(value: unknown): value is { name: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string"
  );
}

function isStringChunkLike(value: unknown): value is { value: string[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "value" in value &&
    Array.isArray(value.value)
  );
}

function isSqlParam(value: unknown): value is { value: unknown } {
  return typeof value === "object" && value !== null && "value" in value;
}

async function readAllBytes(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    byteLength += value.byteLength;
  }

  const result = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}
