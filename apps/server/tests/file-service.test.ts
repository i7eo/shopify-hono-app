import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFile,
  createFiles,
  deleteFile,
  downloadFile,
  getFile,
} from "@/app/modules/file/service";
import {
  disposeRuntimeCapabilities,
  setRuntimeCapability,
} from "@/app/runtime/capabilities";
import { runtimeConfig } from "./shopify/test-utils";
import type {
  FileDownloadResolver,
  FileListInput,
  FileLookup,
  FileRecord,
  FilesPage,
  FilesStore,
  FileStatusUpdate,
} from "@/app/modules/file/domain/files";
import type {
  Bucket,
  BucketReadableObject,
  BucketStoredObject,
} from "@/infra/bucket";

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
  store?: FilesStore;
}) {
  const store = options.store ?? createMemoryMetadataStore();
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

  setRuntimeCapability("moduleFileFilesStoreFactory", () => store);
  setRuntimeCapability("moduleFileBucketFactory", () => bucket);
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

function createMemoryMetadataStore(): FilesStore {
  const files = new Map<string, FileRecord>();

  return {
    create(file: FileRecord): Promise<void> {
      files.set(file.id, cloneFile(file));
      return Promise.resolve();
    },
    findById(input: FileLookup): Promise<FileRecord | null> {
      const file = files.get(input.id);
      return Promise.resolve(
        !file || file.shopDomain !== input.shopDomain ? null : cloneFile(file),
      );
    },
    list(input: FileListInput): Promise<FilesPage> {
      const visibleFiles = [...files.values()]
        .filter(
          (file) =>
            file.shopDomain === input.shopDomain &&
            !file.deletedAt &&
            file.status !== "deleted" &&
            file.status !== "failed",
        )
        .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const start = input.cursor
        ? Math.max(
            visibleFiles.findIndex((file) => file.id === input.cursor) + 1,
            0,
          )
        : 0;
      const page = visibleFiles.slice(start, start + input.limit);
      const next = visibleFiles[start + input.limit];

      return Promise.resolve({
        files: page.map(cloneFile),
        nextCursor: next?.id,
      });
    },
    updateStatus(input: FileStatusUpdate): Promise<void> {
      const file = files.get(input.id);
      if (!file || file.shopDomain !== input.shopDomain) {
        return Promise.resolve();
      }

      files.set(input.id, {
        ...file,
        deletedAt: input.deletedAt ?? file.deletedAt,
        status: input.status,
        updatedAt: new Date(),
      });
      return Promise.resolve();
    },
    delete(input: FileLookup): Promise<void> {
      const file = files.get(input.id);
      if (!file || file.shopDomain !== input.shopDomain) {
        return Promise.resolve();
      }

      const now = new Date();
      files.set(input.id, {
        ...file,
        deletedAt: now,
        status: "deleted",
        updatedAt: now,
      });
      return Promise.resolve();
    },
  };
}

function cloneFile(file: FileRecord): FileRecord {
  return {
    ...file,
    createdAt: new Date(file.createdAt),
    deletedAt: file.deletedAt ? new Date(file.deletedAt) : undefined,
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
