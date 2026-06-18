import { isIsolateRuntime } from "@/utils";
import type { IsolateSchedulerOptions } from "./isolate";
import type { Scheduler } from "./shared";
import type { RuntimeConfig } from "@/infra/env";

const ISOLATE_SCHEDULER_MODULE = "./isolate";
const PROCESS_SCHEDULER_MODULE = "./process";

export async function createScheduler(
  config: RuntimeConfig,
  isolateOptions?: IsolateSchedulerOptions,
): Promise<Scheduler> {
  if (isIsolateRuntime(config.APP_RUNTIME)) {
    const { createIsolateScheduler } = await import(ISOLATE_SCHEDULER_MODULE);
    return createIsolateScheduler(config, isolateOptions);
  }

  const { createProcessScheduler } = await import(PROCESS_SCHEDULER_MODULE);
  return createProcessScheduler(config);
}

export async function disposeScheduler(
  config: Pick<RuntimeConfig, "APP_RUNTIME">,
): Promise<void> {
  if (isIsolateRuntime(config.APP_RUNTIME)) {
    const { disposeIsolateScheduler } = await import(ISOLATE_SCHEDULER_MODULE);
    await disposeIsolateScheduler();
    return;
  }

  const { disposeProcessScheduler } = await import(PROCESS_SCHEDULER_MODULE);
  await disposeProcessScheduler();
}

export { registerSchedulerTask } from "./registry";
export type {
  SchedulerTaskContext,
  SchedulerTaskDefinition,
  SchedulerTaskHandler,
} from "./registry";
export type { Scheduler } from "./shared";
