import { afterEach, describe, expect, it, vi } from "vitest";
import { runtimeConfig } from "./shopify/test-utils";

describe("infra providers", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/infra/env");
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
    const cached = getEnvProvider(
      { APP_RUNTIME: runtimeConfig.APP_RUNTIME },
      {
        merge: true,
      },
    );
    const changed = getEnvProvider(
      { SCOPES: "read_products" },
      {
        merge: true,
      },
    );

    expect(cached).toBe(first);
    expect(changed).not.toBe(first);
    expect(getRuntimeConfig).toHaveBeenCalledTimes(2);

    resetEnvProvider();
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
