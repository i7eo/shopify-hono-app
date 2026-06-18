import { DEFAULT_APP_SCHEDULER_PROVIDERS } from "@shamt/app-env";
import { internalServerError } from "@/shared/exceptions";
import {
  findSchedulerTasksByCron,
  type SchedulerTaskContext,
} from "./registry";
import { getSchedulerEnvConfig } from "./shared";
import type { RuntimeConfig } from "@/infra/env";

export type IsolateSchedulerOptions = {
  cron?: string;
};

export function createIsolateScheduler(
  config: RuntimeConfig,
  // eslint-disable-next-line unused-imports/no-unused-vars
  _options: IsolateSchedulerOptions = {},
) {
  const strategy = getSchedulerEnvConfig(config);

  if (strategy.provider === DEFAULT_APP_SCHEDULER_PROVIDERS.CRONTRIGGERS) {
    return {
      start: () => Promise.resolve(),
      stop: () => Promise.resolve(),
    };
  }

  throw internalServerError(
    "Isolate runtime does not support scheduler provider",
    {
      details: strategy,
      expose: true,
    },
  );
}

export async function runCloudflareScheduledTasks(
  cron: string,
  context: SchedulerTaskContext,
): Promise<void> {
  const tasks = findSchedulerTasksByCron(cron);

  await Promise.all(
    tasks.map((task) =>
      task.handler({
        ...context,
        cron,
      }),
    ),
  );
}
