import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBucketDownloadSigner } from "@/infra/bucket";
import { createIsolateBucket } from "@/infra/bucket/isolate";
import { getRuntimeConfig, type RuntimeConfig } from "@/infra/env";
import { runtimeConfig } from "./shopify/test-utils";

const objects = new Map<string, Uint8Array>();
const sentCommands: Array<{ input: Record<string, unknown>; type: string }> =
  [];
const signedRequests: Array<{
  commandInput: Record<string, unknown>;
  expiresIn?: number;
}> = [];

vi.mock("@aws-sdk/client-s3", () => {
  class PutObjectCommand {
    readonly type = "put";

    constructor(readonly input: Record<string, unknown>) {}
  }

  class GetObjectCommand {
    readonly type = "get";

    constructor(readonly input: Record<string, unknown>) {}
  }

  class DeleteObjectCommand {
    readonly type = "delete";

    constructor(readonly input: Record<string, unknown>) {}
  }

  class S3Client {
    async send(
      command: PutObjectCommand | GetObjectCommand | DeleteObjectCommand,
    ) {
      sentCommands.push({
        input: command.input,
        type: command.type,
      });

      if (command.type === "put") {
        objects.set(
          command.input.Key as string,
          await readBody(command.input.Body as ReadableStream<Uint8Array>),
        );
        return {};
      }

      if (command.type === "get") {
        const bytes = objects.get(command.input.Key as string);
        return bytes
          ? {
              Body: streamFromBytes(bytes),
              ContentLength: bytes.byteLength,
            }
          : {};
      }

      objects.delete(command.input.Key as string);
      return {};
    }
  }

  return {
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(
    async (
      _client: unknown,
      command: { input: Record<string, unknown> },
      options: { expiresIn?: number },
    ) => {
      await signedRequests.push({
        commandInput: command.input,
        expiresIn: options.expiresIn,
      });

      return `https://signed.example.com/${command.input.Key as string}`;
    },
  ),
}));

describe("isolate R2 binding bucket", () => {
  beforeEach(() => {
    objects.clear();
    sentCommands.length = 0;
    signedRequests.length = 0;
    vi.unstubAllGlobals();
  });

  it("uses the Cloudflare R2 binding for uploads, reads, and deletes", async () => {
    const r2 = createR2Binding();
    const bucket = createIsolateBucket(createCloudflareR2Config(), { r2 });

    const stored = await bucket.put({
      body: streamFromText("hello"),
      contentType: "text/plain",
      expiresAt: new Date(Date.now() + 1000),
      key: "test-shop/2026/06/file/hello.txt",
      maxBytes: 10,
      originalName: "hello.txt",
      safeName: "hello.txt",
      shopDomain: "test-shop.myshopify.com",
    });

    expect(stored).toEqual({
      byteSize: 5,
      key: "test-shop/2026/06/file/hello.txt",
      provider: "r2",
    });
    expect(r2.put).toHaveBeenCalledWith(
      "test-shop/2026/06/file/hello.txt",
      expect.any(ReadableStream),
      expect.objectContaining({
        customMetadata: expect.objectContaining({
          originalName: "hello.txt",
          safeName: "hello.txt",
          shopDomain: "test-shop.myshopify.com",
        }),
        httpMetadata: {
          contentType: "text/plain",
        },
      }),
    );

    const opened = await bucket.open({ key: stored.key });
    expect(opened.byteSize).toBe(5);
    await expect(new Response(opened.body).text()).resolves.toBe("hello");

    await bucket.delete({ key: stored.key });
    expect(r2.get).toHaveBeenCalledWith("test-shop/2026/06/file/hello.txt");
    expect(r2.delete).toHaveBeenCalledWith("test-shop/2026/06/file/hello.txt");
    await expect(bucket.open({ key: stored.key })).rejects.toMatchObject({
      message: "Failed to open R2 bucket object",
    });
  });

  it("requires the Cloudflare R2 binding for isolate R2 buckets", () => {
    expect(() => createIsolateBucket(createCloudflareR2Config())).toThrow(
      "Cloudflare R2 bucket binding is required",
    );
  });

  it("rejects binding uploads over maxBytes before the object is stored", async () => {
    const r2 = createR2Binding();
    const bucket = createIsolateBucket(createCloudflareR2Config(), { r2 });

    await expect(
      bucket.put({
        body: streamFromText("hello"),
        contentType: "text/plain",
        expiresAt: new Date(Date.now() + 1000),
        key: "test-shop/hello.txt",
        maxBytes: 4,
        originalName: "hello.txt",
        safeName: "hello.txt",
        shopDomain: "test-shop.myshopify.com",
      }),
    ).rejects.toMatchObject({
      status: 413,
    });

    await expect(
      bucket.open({ key: "test-shop/hello.txt" }),
    ).rejects.toMatchObject({
      message: "Failed to open R2 bucket object",
    });
  });
});

describe("process R2 S3-compatible download signer", () => {
  beforeEach(() => {
    objects.clear();
    sentCommands.length = 0;
    signedRequests.length = 0;
  });

  it("does not create signed download URLs for isolate R2 bindings", async () => {
    await expect(
      createBucketDownloadSigner(createCloudflareR2Config()),
    ).resolves.toBeUndefined();
  });

  it("creates short-lived Node R2 signed download URLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          result: {
            id: "access_key",
          },
        }),
      ),
    );

    const signer = await createBucketDownloadSigner(createNodeR2Config());
    const url = await signer?.signDownloadUrl({
      contentType: "text/csv",
      expiresInMilliseconds: 300_000,
      key: "test-shop/report.csv",
      originalName: "export report.csv",
    });

    expect(url).toBe("https://signed.example.com/test-shop/report.csv");
    expect(signedRequests).toEqual([
      {
        commandInput: {
          Bucket: "product-export",
          Key: "test-shop/report.csv",
          ResponseContentDisposition:
            "attachment; filename*=UTF-8''export%20report.csv",
          ResponseContentType: "text/csv",
        },
        expiresIn: 300,
      },
    ]);
  });
});

function createCloudflareR2Config(): RuntimeConfig {
  const config = getRuntimeConfig({
    ...runtimeConfig,
    APP_BUCKET_PROVIDER: "r2",
    APP_BUCKET_R2_URL:
      "https://account-id.r2.cloudflarestorage.com/product-export",
    APP_CLOUDFLARE_USER_TOKEN: "token_value",
    APP_RUNTIME: "cloudflare",
  });

  return config;
}

function createNodeR2Config(): RuntimeConfig {
  const config = getRuntimeConfig({
    ...runtimeConfig,
    APP_BUCKET_PROVIDER: "r2",
    APP_BUCKET_R2_URL:
      "https://account-id.r2.cloudflarestorage.com/product-export",
    APP_CLOUDFLARE_USER_TOKEN: "token_value",
    APP_RUNTIME: "node",
  });

  return config;
}

function createR2Binding(): R2Bucket {
  const r2Objects = new Map<string, Uint8Array>();
  return {
    delete: vi.fn((key: string) => {
      r2Objects.delete(key);
    }),
    get: vi.fn((key: string) => {
      const bytes = r2Objects.get(key);
      return bytes
        ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          ({
            body: streamFromBytes(bytes),
            size: bytes.byteLength,
          } as R2ObjectBody)
        : null;
    }),
    put: vi.fn(async (key: string, body: ReadableStream<Uint8Array>) => {
      r2Objects.set(key, await readBody(body));
      return null;
    }),
  } as unknown as R2Bucket;
}

async function readBody(body: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(body).arrayBuffer());
}

function streamFromBytes(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function streamFromText(value: string): ReadableStream<Uint8Array> {
  return streamFromBytes(new TextEncoder().encode(value));
}
