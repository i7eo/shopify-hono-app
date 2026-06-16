import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import { describe, expect, it } from "vitest";
import { getDatabaseEnvConfig } from "@/infra/database";
import { createIsolateDatabase } from "@/infra/database/isolate";
import { createProcessDatabase } from "@/infra/database/process";
import { runtimeConfig } from "./shopify/test-utils";
import type { RuntimeConfig } from "@/infra/env";

describe("database runtime strategy", () => {
  it("supports node with postgres", () => {
    expect(
      getDatabaseEnvConfig({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES,
        APP_RUNTIME: "node",
      } as RuntimeConfig),
    ).toEqual({
      provider: DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES,
      runtime: "node",
    });
  });

  it("supports node with d1 as a reserved provider", () => {
    expect(
      getDatabaseEnvConfig({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.D1,
        APP_RUNTIME: "node",
      } as RuntimeConfig),
    ).toEqual({
      provider: DEFAULT_APP_DATABASE_PROVIDERS.D1,
      runtime: "node",
    });
  });

  it("supports cloudflare with postgres", () => {
    expect(
      getDatabaseEnvConfig({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES,
        APP_RUNTIME: "cloudflare",
      } as RuntimeConfig),
    ).toEqual({
      provider: DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES,
      runtime: "cloudflare",
    });
  });

  it("supports cloudflare with d1 as a reserved provider", () => {
    expect(
      getDatabaseEnvConfig({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.D1,
        APP_RUNTIME: "cloudflare",
      } as RuntimeConfig),
    ).toEqual({
      provider: DEFAULT_APP_DATABASE_PROVIDERS.D1,
      runtime: "cloudflare",
    });
  });

  it("reserves but does not implement node d1 yet", async () => {
    await expect(
      createProcessDatabase({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.D1,
        APP_RUNTIME: "node",
      } as RuntimeConfig),
    ).rejects.toMatchObject({
      status: 503,
      message: "D1 database is not implemented for Node runtime yet",
    });
  });

  it("requires d1 binding for cloudflare d1", async () => {
    await expect(
      createIsolateDatabase({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.D1,
        APP_RUNTIME: "cloudflare",
      } as RuntimeConfig),
    ).rejects.toMatchObject({
      status: 500,
      message: "Cloudflare D1 binding is required",
    });
  });

  it("supports cloudflare d1 with a binding", async () => {
    const database = await createIsolateDatabase(
      {
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.D1,
        APP_RUNTIME: "cloudflare",
      } as RuntimeConfig,
      {
        d1: createD1Binding(),
      },
    );

    expect(database).toMatchObject({
      dialect: "sqlite",
      provider: DEFAULT_APP_DATABASE_PROVIDERS.D1,
      runtime: "cloudflare",
    });
  });

  it("requires hyperdrive for cloudflare postgres", async () => {
    await expect(
      createIsolateDatabase({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES,
        APP_RUNTIME: "cloudflare",
      } as RuntimeConfig),
    ).rejects.toMatchObject({
      status: 500,
      message: "Cloudflare Hyperdrive binding is required",
    });
  });
});

function createD1Binding(): D1Database {
  return {
    batch: () => Promise.resolve([]),
    dump: () => Promise.resolve(new ArrayBuffer(0)),
    exec: () =>
      Promise.resolve({
        count: 0,
        duration: 0,
      }),
    prepare: () =>
      ({
        all: () =>
          Promise.resolve({
            meta: {},
            results: [],
            success: true,
          }),
        bind() {
          return this;
        },
        first: () => Promise.resolve(null),
        raw: () => Promise.resolve([]),
        run: () =>
          Promise.resolve({
            meta: {},
            success: true,
          }),
      }) as unknown as D1PreparedStatement,
  } as unknown as D1Database;
}
