import { describe, expect, it } from "vitest";
import { getDatabaseRuntimeStrategy } from "@/infra/database";
import { createIsolateDatabase } from "@/infra/database/isolate";
import { createProcessDatabase } from "@/infra/database/process";
import { runtimeConfig } from "./shopify/test-utils";
import type { RuntimeConfig } from "@/infra/env";

describe("database runtime strategy", () => {
  it("supports node with postgres", () => {
    expect(
      getDatabaseRuntimeStrategy({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: "postgres",
        APP_RUNTIME: "node",
      } as RuntimeConfig),
    ).toEqual({
      provider: "postgres",
      runtime: "node",
    });
  });

  it("supports node with d1 as a reserved provider", () => {
    expect(
      getDatabaseRuntimeStrategy({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: "d1",
        APP_RUNTIME: "node",
      } as RuntimeConfig),
    ).toEqual({
      provider: "d1",
      runtime: "node",
    });
  });

  it("supports cloudflare with postgres", () => {
    expect(
      getDatabaseRuntimeStrategy({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: "postgres",
        APP_RUNTIME: "cloudflare",
      } as RuntimeConfig),
    ).toEqual({
      provider: "postgres",
      runtime: "cloudflare",
    });
  });

  it("supports cloudflare with d1 as a reserved provider", () => {
    expect(
      getDatabaseRuntimeStrategy({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: "d1",
        APP_RUNTIME: "cloudflare",
      } as RuntimeConfig),
    ).toEqual({
      provider: "d1",
      runtime: "cloudflare",
    });
  });

  it("reserves but does not implement node d1 yet", async () => {
    await expect(
      createProcessDatabase({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: "d1",
        APP_RUNTIME: "node",
      } as RuntimeConfig),
    ).rejects.toMatchObject({
      status: 503,
      message: "D1 database is not implemented for Node runtime yet",
    });
  });

  it("reserves but does not implement cloudflare d1 yet", async () => {
    await expect(
      createIsolateDatabase({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: "d1",
        APP_RUNTIME: "cloudflare",
      } as RuntimeConfig),
    ).rejects.toMatchObject({
      status: 503,
      message: "D1 database is reserved but not implemented yet",
    });
  });

  it("requires hyperdrive for cloudflare postgres", async () => {
    await expect(
      createIsolateDatabase({
        ...runtimeConfig,
        APP_DATABASE_PROVIDER: "postgres",
        APP_RUNTIME: "cloudflare",
      } as RuntimeConfig),
    ).rejects.toMatchObject({
      status: 500,
      message: "Cloudflare Hyperdrive binding is required",
    });
  });
});
