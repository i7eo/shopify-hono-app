import { describe, expect, it } from "vitest";
import { getBucketEnvConfig, getR2BucketConfig } from "@/infra/bucket";
import { runtimeConfig } from "./shopify/test-utils";
import type { RuntimeConfig } from "@/infra/env";

describe("bucket runtime strategy", () => {
  it("supports node with memory bucket", () => {
    expect(
      getBucketEnvConfig({
        ...runtimeConfig,
        APP_BUCKET_PROVIDER: "memory",
        APP_RUNTIME: "node",
      } as RuntimeConfig),
    ).toEqual({
      provider: "memory",
      runtime: "node",
    });
  });

  it("supports node with r2 bucket", () => {
    expect(
      getBucketEnvConfig({
        ...runtimeConfig,
        APP_BUCKET_PROVIDER: "r2",
        APP_RUNTIME: "node",
      } as RuntimeConfig),
    ).toEqual({
      provider: "r2",
      runtime: "node",
    });
  });

  it("parses r2 endpoint and credentials for node r2 bucket", () => {
    expect(
      getR2BucketConfig({
        ...runtimeConfig,
        APP_BUCKET_PROVIDER: "r2",
        APP_BUCKET_R2_KEY: "access_key",
        APP_BUCKET_R2_URL:
          "https://account-id.r2.cloudflarestorage.com/product-export",
        APP_BUCKET_R2_VALUE: "secret_key",
      } as RuntimeConfig),
    ).toEqual({
      accessKeyId: "access_key",
      bucketName: "product-export",
      endpoint: "https://account-id.r2.cloudflarestorage.com",
      secretAccessKey: "secret_key",
    });
  });

  it("rejects incomplete r2 config", () => {
    expect(() =>
      getR2BucketConfig({
        ...runtimeConfig,
        APP_BUCKET_PROVIDER: "r2",
        APP_BUCKET_R2_KEY: "access_key",
      } as RuntimeConfig),
    ).toThrow("R2 bucket config is incomplete");
  });

  it("supports cloudflare with r2 bucket", () => {
    expect(
      getBucketEnvConfig({
        ...runtimeConfig,
        APP_BUCKET_PROVIDER: "r2",
        APP_RUNTIME: "cloudflare",
      } as RuntimeConfig),
    ).toEqual({
      provider: "r2",
      runtime: "cloudflare",
    });
  });

  it("defaults node to memory bucket", () => {
    const { APP_BUCKET_PROVIDER: _provider, ...config } = runtimeConfig;

    expect(
      getBucketEnvConfig({
        ...config,
        APP_RUNTIME: "node",
      } as RuntimeConfig),
    ).toEqual({
      provider: "memory",
      runtime: "node",
    });
  });

  it("defaults cloudflare to r2 bucket", () => {
    const { APP_BUCKET_PROVIDER: _provider, ...config } = runtimeConfig;

    expect(
      getBucketEnvConfig({
        ...config,
        APP_RUNTIME: "cloudflare",
      } as RuntimeConfig),
    ).toEqual({
      provider: "r2",
      runtime: "cloudflare",
    });
  });

  it("rejects cloudflare with memory bucket", () => {
    expect(() =>
      getBucketEnvConfig({
        ...runtimeConfig,
        APP_BUCKET_PROVIDER: "memory",
        APP_RUNTIME: "cloudflare",
      } as RuntimeConfig),
    ).toThrow("Cloudflare runtime only supports the r2 bucket provider");
  });
});
