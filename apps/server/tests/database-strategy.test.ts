import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDatabaseEnvConfig } from "@/infra/database";
import { createIsolateDatabase } from "@/infra/database/isolate";
import {
  disposeProcessDatabase,
  getProcessDatabase,
} from "@/infra/database/process";
import { getRuntimeConfig, type RuntimeConfig } from "@/infra/env";
import { runtimeConfig } from "./shopify/test-utils";

const poolEnd = vi.fn(() => Promise.resolve());
const poolInstances: Array<{ connectionString: string | undefined }> = [];

vi.mock("pg", () => ({
  Pool: vi.fn(function Pool(input: { connectionString?: string }) {
    poolInstances.push(input);

    return {
      end: poolEnd,
    };
  }),
}));

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: vi.fn((input: unknown) => ({
    input,
    kind: "postgres-db",
  })),
}));

describe("database runtime strategy", () => {
  afterEach(() => {
    poolEnd.mockClear();
    poolInstances.length = 0;
    vi.clearAllMocks();
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

  it("parses node with d1 before database strategy validation", () => {
    expect(
      getRuntimeConfig({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.D1,
        APP_RUNTIME: "node",
      }),
    ).toMatchObject({
      APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.D1,
      APP_RUNTIME: "node",
    });
  });

  it("rejects node with d1 at the database strategy boundary", () => {
    expect(() =>
      getDatabaseEnvConfig({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.D1,
        APP_RUNTIME: "node",
      } as RuntimeConfig),
    ).toThrow("Node runtime only supports the postgres database provider");
  });

  it("parses cloudflare with postgres before database strategy validation", () => {
    expect(
      getRuntimeConfig({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES,
        APP_RUNTIME: "cloudflare",
      }),
    ).toMatchObject({
      APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES,
      APP_RUNTIME: "cloudflare",
    });
  });

  it("rejects cloudflare with postgres at the database strategy boundary", () => {
    expect(() =>
      getDatabaseEnvConfig({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES,
        APP_RUNTIME: "cloudflare",
      } as RuntimeConfig),
    ).toThrow("Cloudflare runtime only supports the d1 database provider");
  });

  it("supports cloudflare with d1", () => {
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

  it("defaults database provider by runtime", () => {
    expect(
      getDatabaseEnvConfig({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: undefined,
        APP_RUNTIME: "node",
      } as RuntimeConfig),
    ).toEqual({
      provider: DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES,
      runtime: "node",
    });

    expect(
      getDatabaseEnvConfig({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: undefined,
        APP_RUNTIME: "cloudflare",
      } as RuntimeConfig),
    ).toEqual({
      provider: DEFAULT_APP_DATABASE_PROVIDERS.D1,
      runtime: "cloudflare",
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

  it("reuses process database promises until the cache key changes", async () => {
    await disposeProcessDatabase();

    const firstConfig: RuntimeConfig = {
      ...runtimeConfig,
      APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES,
      APP_DATABASE_URL: "postgresql://first",
      APP_RUNTIME: "node",
    };
    const secondConfig: RuntimeConfig = {
      ...firstConfig,
      APP_DATABASE_URL: "postgresql://second",
    };

    const first = getProcessDatabase(firstConfig);
    const second = getProcessDatabase(firstConfig);
    expect(first).toBe(second);
    await first;

    const third = getProcessDatabase(secondConfig);
    expect(third).not.toBe(first);
    await third;

    expect(poolInstances.map((input) => input.connectionString)).toEqual([
      "postgresql://first",
      "postgresql://second",
    ]);

    await disposeProcessDatabase();
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
