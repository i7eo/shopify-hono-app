import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDatabaseEnvConfig } from "@/infra/database";
import { createIsolateDatabase } from "@/infra/database/isolate";
import { createProcessDatabase } from "@/infra/database/process";
import { runtimeConfig } from "./shopify/test-utils";
import type { RuntimeConfig } from "@/infra/env";

describe("database runtime strategy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

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

  it("supports node d1 through the D1 HTTP API", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(
        Response.json({
          result: {
            meta: {},
            results: [{ id: 1 }],
            success: true,
          },
          success: true,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const database = await createProcessDatabase({
      ...runtimeConfig,
      APP_CLOUDFLARE_WORKER_ACCOUNT_ID: "account_test",
      APP_CLOUDFLARE_USER_TOKEN: "token_test",
      APP_DATABASE_D1_NAME: "account_test",
      APP_DATABASE_D1_BINDING: "https://api.cloudflare.com",
      APP_DATABASE_D1_ID: "database_test",
      APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.D1,
      APP_RUNTIME: "node",
    } as RuntimeConfig);
    const result = await database.db.$client
      .prepare("select ? as id")
      .bind(1)
      .run();

    expect(database).toMatchObject({
      dialect: "sqlite",
      provider: DEFAULT_APP_DATABASE_PROVIDERS.D1,
      runtime: "node",
    });
    expect(result.results).toEqual([{ id: 1 }]);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/account_test/d1/database/database_test/query",
      expect.objectContaining({
        body: JSON.stringify({
          params: [1],
          sql: "select ? as id",
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer token_test",
          "Content-Type": "application/json",
        }),
        method: "POST",
      }),
    );
  });

  it("requires D1 HTTP config for node d1", async () => {
    await expect(
      createProcessDatabase({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.D1,
        APP_RUNTIME: "node",
      } as RuntimeConfig),
    ).rejects.toMatchObject({
      status: 500,
      message: "D1 HTTP database config is incomplete",
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
