import type { FileTaskDispatcher } from "@/app/modules/file/tasks/noop-file-task-dispatcher";
import type { FileDownloadResolver } from "@/app/modules/file/types";
import type { Bucket } from "@/infra/bucket";
import type { Database } from "@/infra/database";
import type { RuntimeConfig } from "@/infra/env";
import type { LoggerSetupOptions } from "@/infra/logger/shared";
import type { QueueProducer } from "@/infra/queue";
import type { AppEnv } from "@/typings";
import type { Context } from "hono";

export type RuntimeLoggerSetup = (
  config: RuntimeConfig,
  options: LoggerSetupOptions,
) => Promise<void>;
export type ModuleHealthDiskCheckResult = {
  path?: string;
  runtime: string;
  status: "ok" | "unsupported";
};
export type ModuleHealthProcessDiskChecker = (
  context: Context<AppEnv>,
) => Promise<ModuleHealthDiskCheckResult> | ModuleHealthDiskCheckResult;
export type RuntimeEnvSourceResolver = (
  context: Context<AppEnv>,
) => Record<string, unknown>;
export type DatabaseFactory = (
  context: Context<AppEnv>,
) => Database | Promise<Database>;
export type BucketFactory = (
  context: Context<AppEnv>,
) => Bucket | Promise<Bucket>;
export type QueueProducerFactory = (
  context: Context<AppEnv>,
) => QueueProducer | Promise<QueueProducer>;
export type ModuleFileDownloadResolverFactory = (
  context: Context<AppEnv>,
) => FileDownloadResolver | Promise<FileDownloadResolver>;
export type ModuleFileTaskDispatcherFactory = (
  context: Context<AppEnv>,
) => FileTaskDispatcher;

export interface RuntimeCapabilityInstances {
  runtimeLoggerSetup: RuntimeLoggerSetup;
  runtimeEnvSourceResolver: RuntimeEnvSourceResolver;
  /**
   * Module Health: checks process disk access when the runtime can touch disk.
   */
  moduleHealthProcessDiskChecker: ModuleHealthProcessDiskChecker;
  /**
   * Infra Database: returns the runtime-specific Drizzle database client.
   */
  databaseFactory: DatabaseFactory;
  /**
   * Infra Bucket: returns the runtime-specific object bucket adapter.
   */
  bucketFactory: BucketFactory;
  /**
   * Infra Queue: returns the runtime-specific queue producer adapter.
   */
  queueProducerFactory: QueueProducerFactory;
  /**
   * Module File: resolves a file download into a stream or redirect.
   */
  moduleFileDownloadResolverFactory: ModuleFileDownloadResolverFactory;
  /**
   * Module File: dispatches background file tasks to the runtime queue.
   */
  moduleFileTaskDispatcherFactory: ModuleFileTaskDispatcherFactory;
}

export type RuntimeCapabilityName = keyof RuntimeCapabilityInstances;
export type RuntimeCapabilityDisposer = () => Promise<void> | void;

const runtimeCapabilities = new Map<
  RuntimeCapabilityName,
  RuntimeCapabilityInstances[RuntimeCapabilityName]
>();
const runtimeCapabilityDisposers = new Map<
  RuntimeCapabilityName,
  RuntimeCapabilityDisposer
>();

/**
 * Reads a registered runtime capability by name.
 */
export function getRuntimeCapability<K extends RuntimeCapabilityName>(
  name: K,
): RuntimeCapabilityInstances[K] | undefined {
  return runtimeCapabilities.get(name) as
    | RuntimeCapabilityInstances[K]
    | undefined;
}

/**
 * Registers a runtime capability and its optional disposer.
 */
export function setRuntimeCapability<K extends RuntimeCapabilityName>(
  name: K,
  capability: RuntimeCapabilityInstances[K],
  disposer: RuntimeCapabilityDisposer = () => resetRuntimeCapability(name),
): void {
  runtimeCapabilities.set(
    name,
    capability as RuntimeCapabilityInstances[RuntimeCapabilityName],
  );
  runtimeCapabilityDisposers.set(name, disposer);
}

/**
 * Removes one runtime capability and its disposer.
 */
export function resetRuntimeCapability(name: RuntimeCapabilityName): void {
  runtimeCapabilities.delete(name);
  runtimeCapabilityDisposers.delete(name);
}

/**
 * Runs all registered capability disposers and clears the registry.
 */
export async function disposeRuntimeCapabilities(): Promise<void> {
  const disposers = [...runtimeCapabilityDisposers.values()];

  for (const dispose of disposers) {
    await dispose();
  }

  runtimeCapabilities.clear();
  runtimeCapabilityDisposers.clear();
}
