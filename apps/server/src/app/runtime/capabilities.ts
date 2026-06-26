import { internalServerError } from "@/shared/exceptions";
import type { FileDownloadResolver } from "@/app/modules/file/types";
import type { RuntimeResourceContext } from "@/app/runtime/resources/context";
import type { Bucket } from "@/infra/bucket";
import type { Database } from "@/infra/database";
import type { RuntimeConfig } from "@/infra/env";
import type { LoggerSetupOptions } from "@/infra/logger/shared";
import type { QueueConsumer, QueueProducer } from "@/infra/queue";
import type { Scheduler } from "@/infra/scheduler";
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
  context: RuntimeResourceContext,
) => Database | Promise<Database>;
export type BucketFactory = (
  context: RuntimeResourceContext,
) => Bucket | Promise<Bucket>;
export type QueueProducerFactory = (
  context: RuntimeResourceContext,
) => QueueProducer | Promise<QueueProducer>;
export type RuntimeQueueConsumer = QueueConsumer<any>;
export type QueueConsumerFactory = (
  config: RuntimeConfig,
) => RuntimeQueueConsumer | Promise<RuntimeQueueConsumer>;
export type SchedulerFactory = (
  config: RuntimeConfig,
) => Scheduler | Promise<Scheduler>;
export type ModuleFileDownloadResolverFactory = (
  context: RuntimeResourceContext,
) => FileDownloadResolver | Promise<FileDownloadResolver>;

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
   * Infra Queue: returns the runtime-specific queue consumer adapter.
   */
  queueConsumerFactory: QueueConsumerFactory;
  /**
   * Infra Scheduler: returns the runtime-specific scheduled task adapter.
   */
  schedulerFactory: SchedulerFactory;
  /**
   * Module File: resolves a file download into a stream or redirect.
   */
  moduleFileDownloadResolverFactory: ModuleFileDownloadResolverFactory;
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
 * Reads a registered runtime capability or fails loudly when it is missing.
 * The throwing companion to {@link getRuntimeCapability}, used by resource
 * factories so they never have to repeat the null-check.
 *
 * @example
 * ```ts
 * const factory = requireCapability("databaseFactory");
 * const database = await factory(resourceContext);
 * ```
 */
export function requireCapability<K extends RuntimeCapabilityName>(
  name: K,
): RuntimeCapabilityInstances[K] {
  const capability = getRuntimeCapability(name);

  if (!capability) {
    throw internalServerError(`Runtime capability is not registered: ${name}`, {
      expose: true,
    });
  }

  return capability;
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
