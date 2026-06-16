import { afterEach, describe, expect, it, vi } from "vitest";
import {
  disposeRuntimeCapabilities,
  getRuntimeCapability,
} from "@/app/runtime/capabilities";
import { getRuntimeConfig } from "@/infra/env";
import { runtimeConfig } from "./shopify/test-utils";
import type { FileRecord } from "@/app/modules/file/types";
import type { Context } from "hono";

vi.mock("@/infra/bucket", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/infra/bucket")>();

  return {
    ...original,
    createBucket: vi.fn(() => ({
      delete: vi.fn(() => {}),
      open: vi.fn(() => {
        throw new Error("R2 download should use signed redirect");
      }),
      put: vi.fn(() => ({
        byteSize: 0,
        key: "unused",
        provider: "r2",
      })),
    })),
    createBucketDownloadSigner: vi.fn(() => ({
      signDownloadUrl: vi.fn(() => "https://signed.example.com/r2-file"),
    })),
  };
});

describe("file download runtime capability", () => {
  afterEach(() => disposeRuntimeCapabilities());

  it("supports R2 signed downloads in Cloudflare runtime", async () => {
    const { registerCloudflareIsolateRuntimeCapabilities } =
      await import("@/app/runtime/isolate/cloudflare/capabilities");
    const runtimeEnv = getRuntimeConfig({
      ...runtimeConfig,
      APP_BUCKET_PROVIDER: "r2",
      APP_BUCKET_R2_KEY: "access_key",
      APP_BUCKET_R2_URL:
        "https://account-id.r2.cloudflarestorage.com/product-export",
      APP_BUCKET_R2_VALUE: "secret_key",
      APP_RUNTIME: "cloudflare",
    });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const context = {
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

    expect(download).toEqual({
      headers: {
        "Cache-Control": "private, no-store",
      },
      type: "redirect",
      url: "https://signed.example.com/r2-file",
    });
  });
});
