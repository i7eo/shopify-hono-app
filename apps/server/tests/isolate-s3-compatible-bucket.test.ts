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

describe("isolate S3-compatible bucket", () => {
  beforeEach(() => {
    objects.clear();
    sentCommands.length = 0;
    signedRequests.length = 0;
  });

  it("uses S3-compatible commands for R2 uploads, reads, and deletes", async () => {
    const bucket = createIsolateBucket(createCloudflareR2Config());

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
    expect(sentCommands[0]).toMatchObject({
      input: {
        Bucket: "product-export",
        ContentType: "text/plain",
        Key: "test-shop/2026/06/file/hello.txt",
      },
      type: "put",
    });

    const opened = await bucket.open({ key: stored.key });
    expect(opened.byteSize).toBe(5);
    await expect(new Response(opened.body).text()).resolves.toBe("hello");

    await bucket.delete({ key: stored.key });
    expect(sentCommands.map((command) => command.type)).toEqual([
      "put",
      "get",
      "delete",
    ]);
    await expect(bucket.open({ key: stored.key })).rejects.toMatchObject({
      message: "Failed to open R2 bucket object",
    });
  });

  it("rejects uploads over maxBytes before the object is stored", async () => {
    const bucket = createIsolateBucket(createCloudflareR2Config());

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

    expect(objects.has("test-shop/hello.txt")).toBe(false);
  });

  it("creates short-lived R2 signed download URLs", async () => {
    const signer = await createBucketDownloadSigner(createCloudflareR2Config());
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
    APP_BUCKET_R2_KEY: "access_key",
    APP_BUCKET_R2_URL:
      "https://account-id.r2.cloudflarestorage.com/product-export",
    APP_BUCKET_R2_VALUE: "secret_key",
    APP_RUNTIME: "cloudflare",
  });

  return config;
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
