import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createScheduler,
  registerSchedulerTask,
  type SchedulerTaskContext,
} from "@/infra/scheduler";
import { runCloudflareScheduledTasks } from "@/infra/scheduler/isolate";
import {
  findSchedulerTasksByCron,
  resetSchedulerTasks,
} from "@/infra/scheduler/registry";
import { getSchedulerEnvConfig } from "@/infra/scheduler/shared";

const context = {
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  runtimeEnv: {
    APP_RUNTIME: "cloudflare",
  },
} as unknown as SchedulerTaskContext;

describe("scheduler runtime strategy", () => {
  it("defaults node to pg-boss", () => {
    expect(
      getSchedulerEnvConfig({
        APP_DATABASE_PROVIDER: "postgres",
        APP_RUNTIME: "node",
      } as any),
    ).toEqual({
      provider: "pg-boss",
      runtime: "node",
    });
  });

  it("defaults cloudflare to cron triggers", () => {
    expect(
      getSchedulerEnvConfig({
        APP_RUNTIME: "cloudflare",
      } as any),
    ).toEqual({
      provider: "cron-triggers",
      runtime: "cloudflare",
    });
  });

  it("rejects unsupported runtime/provider pairs", () => {
    expect(() =>
      getSchedulerEnvConfig({
        APP_DATABASE_PROVIDER: "postgres",
        APP_RUNTIME: "node",
        APP_SCHEDULER_PROVIDER: "cron-triggers",
      } as any),
    ).toThrow(/Node runtime only supports/);

    expect(() =>
      getSchedulerEnvConfig({
        APP_RUNTIME: "cloudflare",
        APP_SCHEDULER_PROVIDER: "pg-boss",
      } as any),
    ).toThrow(/Cloudflare runtime only supports/);
  });

  it("requires postgres for node pg-boss", () => {
    expect(() =>
      getSchedulerEnvConfig({
        APP_DATABASE_PROVIDER: "d1",
        APP_RUNTIME: "node",
        APP_SCHEDULER_PROVIDER: "pg-boss",
      } as any),
    ).toThrow(/requires the postgres database provider/);
  });
});

describe("scheduler registry", () => {
  afterEach(() => {
    resetSchedulerTasks();
    vi.clearAllMocks();
  });

  it("finds tasks by cron value", () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registerSchedulerTask({
      cron: "*/5 * * * *",
      handler,
      name: "test:five",
    });
    registerSchedulerTask({
      cron: "0 * * * *",
      handler,
      name: "test:hourly",
    });

    expect(
      findSchedulerTasksByCron("*/5 * * * *").map((task) => task.name),
    ).toEqual(["test:five"]);
  });

  it("runs only matching cloudflare scheduled tasks", async () => {
    const everyFive = vi.fn().mockResolvedValue(undefined);
    const hourly = vi.fn().mockResolvedValue(undefined);
    registerSchedulerTask({
      cron: "*/5 * * * *",
      handler: everyFive,
      name: "test:five",
    });
    registerSchedulerTask({
      cron: "0 * * * *",
      handler: hourly,
      name: "test:hourly",
    });

    await runCloudflareScheduledTasks("*/5 * * * *", context);

    expect(everyFive).toHaveBeenCalledWith({
      ...context,
      cron: "*/5 * * * *",
    });
    expect(hourly).not.toHaveBeenCalled();
  });

  it("creates a cloudflare scheduler that runs matching tasks", async () => {
    const everyFive = vi.fn().mockResolvedValue(undefined);
    registerSchedulerTask({
      cron: "*/5 * * * *",
      handler: everyFive,
      name: "test:five",
    });

    const scheduler = await createScheduler({
      APP_RUNTIME: "cloudflare",
    } as any);
    await scheduler.run("*/5 * * * *", context);

    expect(everyFive).toHaveBeenCalledWith({
      ...context,
      cron: "*/5 * * * *",
    });
  });
});
