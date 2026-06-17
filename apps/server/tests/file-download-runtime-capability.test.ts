import { afterEach, describe, expect, it, vi } from "vitest";
import {
  disposeRuntimeCapabilities,
  getRuntimeCapability,
} from "@/app/runtime/capabilities";
import { getRuntimeConfig } from "@/infra/env";
import { runtimeConfig } from "./shopify/test-utils";
import type { FileRecord } from "@/app/modules/file/types";
import type { Context } from "hono";

describe("file download runtime capability", () => {
  afterEach(() => disposeRuntimeCapabilities());

  it("streams R2 downloads through the Cloudflare binding", async () => {
    const { registerCloudflareIsolateRuntimeCapabilities } =
      await import("@/app/runtime/isolate/cloudflare/capabilities");
    const runtimeEnv = getRuntimeConfig({
      ...runtimeConfig,
      APP_BUCKET_PROVIDER: "r2",
      APP_RUNTIME: "cloudflare",
    });
    const r2 = createR2Binding({
      "shop/file.csv": new TextEncoder().encode("r2-body"),
    });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const context = {
      env: {
        APP_RUNTIME: "cloudflare",
        test_r2: r2,
      },
      get: (key: string) => (key === "runtimeEnv" ? runtimeEnv : undefined),
    } as Context;
    const file: FileRecord = {
      bucketKey: "shop/file.csv",
      bucketProvider: "r2",
      byteSize: 7,
      contentType: "text/csv",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      id: "file_r2",
      originalName: "file.csv",
      safeName: "file.csv",
      shopDomain: "shop.myshopify.com",
      status: "available",
      updatedAt: new Date(),
      deletedAt: null,
    };

    registerCloudflareIsolateRuntimeCapabilities();

    const factory = getRuntimeCapability("moduleFileDownloadResolverFactory");
    const resolver = await factory?.(context);
    const download = await resolver?.resolve({ file });

    expect(download?.type).toBe("stream");
    expect(download?.headers).toEqual({
      "Cache-Control": "private, no-store",
      "Content-Disposition": "attachment; filename*=UTF-8''file.csv",
      "Content-Length": "7",
      "Content-Type": "text/csv",
    });
    expect(r2.get).toHaveBeenCalledWith("shop/file.csv");

    if (download?.type !== "stream") {
      throw new Error("Expected a stream download");
    }

    await expect(new Response(download.body).text()).resolves.toBe("r2-body");
  });
});

function createR2Binding(initialObjects: Record<string, Uint8Array>): R2Bucket {
  const objects = new Map(Object.entries(initialObjects));
  const bucket: R2Bucket = {
    createMultipartUpload: vi.fn(),
    delete: vi.fn((key: string) => {
      objects.delete(key);
      return Promise.resolve();
    }),
    get: vi.fn((key: string) => {
      const bytes = objects.get(key);
      const object: R2ObjectBody | null = bytes
        ? {
            body: streamFromBytes(bytes),
            size: bytes.byteLength,
          }
        : null;
      return Promise.resolve(object);
    }),
    put: vi.fn(async (key: string, body: ReadableStream<Uint8Array>) => {
      objects.set(key, new Uint8Array(await new Response(body).arrayBuffer()));
      return null;
    }),
    resumeMultipartUpload: vi.fn(),
  };

  return bucket;
}

function streamFromBytes(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}
