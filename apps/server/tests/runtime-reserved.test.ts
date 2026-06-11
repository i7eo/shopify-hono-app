import { DEFAULT_RUNTIMES } from "@shamt/app-env";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockContext, runtimeConfig } from "./shopify/test-utils";

describe("reserved runtimes", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("parses Vercel Edge as a reserved isolate runtime", async () => {
    const { getRuntimeConfig } = await import("@/infra/env");
    const config = getRuntimeConfig({
      ...process.env,
      ...runtimeConfig,
      APP_RUNTIME: DEFAULT_RUNTIMES.VERCEL_EDGE,
    });

    expect(config.APP_RUNTIME).toBe(DEFAULT_RUNTIMES.VERCEL_EDGE);
  });

  it("fails fast for Shopify session storage when no Vercel Edge runtime capability is registered", async () => {
    const { getShopifySessionStorage } =
      await import("@/app/modules/shopify/session-storage");
    const context = createMockContext({
      vars: {
        runtimeEnv: {
          ...runtimeConfig,
          APP_RUNTIME: DEFAULT_RUNTIMES.VERCEL_EDGE,
        },
      },
    });

    expect(() => getShopifySessionStorage(context as never)).toThrow(
      "Shopify session storage is not configured for this runtime",
    );
  });
});
