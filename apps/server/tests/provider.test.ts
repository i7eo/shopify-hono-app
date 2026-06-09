import { afterEach, describe, expect, it, vi } from "vitest";
import { runtimeConfig } from "./shopify/test-utils";

describe("infra providers", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/infra/env");
    vi.doUnmock("@shamt/oh-my-fetch");
  });

  it("reuses env provider while the effective env signature is unchanged", async () => {
    const getRuntimeConfig = vi.fn((rawEnv) => ({
      ...(rawEnv as Record<string, unknown>),
      parsedAt: getRuntimeConfig.mock.calls.length,
    }));
    vi.doMock("@/infra/env", () => ({
      getRuntimeConfig,
    }));

    const { getEnvProvider, resetEnvProvider } =
      await import("@/infra/provider/env");
    const first = getEnvProvider(runtimeConfig);
    const cached = getEnvProvider(runtimeConfig);
    const changed = getEnvProvider({
      ...runtimeConfig,
      SCOPES: "read_products",
    });

    expect(cached).toBe(first);
    expect(changed).not.toBe(first);
    expect(getRuntimeConfig).toHaveBeenCalledTimes(2);

    resetEnvProvider();
  });

  it("creates the HTTP client with APP_REQUEST_TIMEOUT from the env provider", async () => {
    const createHttpClient = vi.fn((options) => ({ options }));
    vi.doMock("@shamt/oh-my-fetch", () => ({
      createHttpClient,
    }));

    const { getClientProvider, getEnvProvider, resetClientProvider } =
      await import("@/infra/provider");
    const env = getEnvProvider({
      ...runtimeConfig,
      APP_REQUEST_TIMEOUT: "1234",
    });

    const client = getClientProvider(env);

    expect(client).toEqual({
      options: expect.objectContaining({
        timeout: 1234,
      }),
    });
    expect(createHttpClient).toHaveBeenCalledTimes(1);
    expect(createHttpClient).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 1234,
      }),
    );

    resetClientProvider();
  });

  it("recreates the HTTP client when APP_REQUEST_TIMEOUT changes", async () => {
    const createHttpClient = vi.fn((options) => ({ options }));
    vi.doMock("@shamt/oh-my-fetch", () => ({
      createHttpClient,
    }));

    const { getClientProvider, getEnvProvider, resetClientProvider } =
      await import("@/infra/provider");
    const firstEnv = getEnvProvider({
      ...runtimeConfig,
      APP_REQUEST_TIMEOUT: 1000,
    });
    const secondEnv = getEnvProvider({
      ...runtimeConfig,
      APP_REQUEST_TIMEOUT: 2000,
    });

    const firstClient = getClientProvider(firstEnv);
    const secondClient = getClientProvider(secondEnv);

    expect(firstClient).not.toBe(secondClient);
    expect(createHttpClient).toHaveBeenCalledTimes(2);
    expect(createHttpClient).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        timeout: 1000,
      }),
    );
    expect(createHttpClient).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        timeout: 2000,
      }),
    );

    resetClientProvider();
  });

  it("disposes providers from a stable disposer snapshot", async () => {
    const { disposeProviders } = await import("@/infra/provider");
    const { providerDisposers, providers } =
      await import("@/infra/provider/constants");
    const calls: string[] = [];

    providers.set("env", runtimeConfig as never);
    providers.set("client", {} as never);
    providerDisposers.set("env", () => {
      calls.push("env");
      providerDisposers.delete("client");
    });
    providerDisposers.set("client", () => {
      calls.push("client");
    });

    await disposeProviders();

    expect(calls).toEqual(["env", "client"]);
    expect(providers.size).toBe(0);
    expect(providerDisposers.size).toBe(0);
  });
});
