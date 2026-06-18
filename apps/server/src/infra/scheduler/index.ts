import { isIsolateRuntime } from "@/utils";
import type { IsolateSchedulerOptions } from "./isolate";
import type { RuntimeConfig } from "@/infra/env";

const ISOLATE_SCHEDULER_MODULE = "./isolate";
const PROCESS_SCHEDULER_MODULE = "./process";

export async function createScheduler(
  config: RuntimeConfig,
  isolateOptions?: IsolateSchedulerOptions,
) {
  if (isIsolateRuntime(config.APP_RUNTIME)) {
    const { createIsolateScheduler } = await import(ISOLATE_SCHEDULER_MODULE);
    return createIsolateScheduler(config, isolateOptions);
  }

  const { getSchedulerEnvConfig } = await import("./shared");
  getSchedulerEnvConfig(config);

  return {
    start: () => Promise.resolve(),
    stop: () => Promise.resolve(),
  };
}

export async function disposeScheduler(
  config: Pick<RuntimeConfig, "APP_RUNTIME">,
): Promise<void> {
  if (isIsolateRuntime(config.APP_RUNTIME)) return;

  const { disposeProcessScheduler } = await import(PROCESS_SCHEDULER_MODULE);
  await disposeProcessScheduler();
}

export { runCloudflareScheduledTasks } from "./isolate";
export {
  createProcessScheduler,
  startProcessScheduler,
  stopProcessScheduler,
} from "./process";
export {
  findSchedulerTasksByCron,
  getSchedulerTask,
  listSchedulerTasks,
  registerSchedulerTask,
  resetSchedulerTasks,
} from "./registry";
export * from "./shared";
export type { IsolateSchedulerOptions } from "./isolate";
export type {
  SchedulerTaskContext,
  SchedulerTaskDefinition,
  SchedulerTaskHandler,
} from "./registry";
