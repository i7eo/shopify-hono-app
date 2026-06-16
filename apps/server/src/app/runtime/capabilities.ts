import type {
  FileDownloadResolver,
  FilesStore,
} from "@/app/modules/file/domain/files";
import type { FileTaskDispatcher } from "@/app/modules/file/tasks/noop-file-task-dispatcher";
import type { Bucket } from "@/infra/bucket";
import type { RuntimeConfig } from "@/infra/env";
import type { LoggerSetupOptions } from "@/infra/logger/shared";
import type { AppEnv } from "@/typings";
import type { Session } from "@shopify/shopify-api";
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
/**
 * Defines the strategy to be used to store sessions for the Shopify App.
 * from shopify-app-session-storage@5.0.0/src/types.ts
 */
export interface ShopifySessionStorage {
  /**
   * Creates or updates the given session in storage.
   *
   * @param session Session to store
   */
  storeSession: (session: Session) => Promise<boolean>;

  /**
   * Loads a session from storage.
   *
   * @param id Id of the session to load
   */
  loadSession: (id: string) => Promise<Session | undefined>;

  /**
   * Deletes a session from storage.
   *
   * @param id Id of the session to delete
   */
  deleteSession: (id: string) => Promise<boolean>;

  /**
   * Deletes an array of sessions from storage.
   *
   * @param ids Array of session id's to delete
   */
  deleteSessions: (ids: string[]) => Promise<boolean>;

  /**
   * Return an array of sessions for a given shop (or [] if none found).
   *
   * @param shop shop of the session(s) to return
   */
  findSessionsByShop: (shop: string) => Promise<Session[]>;
}
export type ModuleShopifySessionStorageFactory = (
  context: Context<AppEnv>,
) => ShopifySessionStorage;
export type ModuleFileFilesStoreFactory = (
  context: Context<AppEnv>,
) => FilesStore;
export type ModuleFileBucketFactory = (
  context: Context<AppEnv>,
) => Bucket | Promise<Bucket>;
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
   * Module Shopify: creates the runtime-specific Shopify session storage.
   */
  moduleShopifySessionStorageFactory: ModuleShopifySessionStorageFactory;
  /**
   * Module File: returns the metadata store used by file services.
   */
  moduleFileFilesStoreFactory: ModuleFileFilesStoreFactory;
  /**
   * Module File: returns the binary object storage adapter.
   */
  moduleFileBucketFactory: ModuleFileBucketFactory;
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

export function getRuntimeCapability<K extends RuntimeCapabilityName>(
  name: K,
): RuntimeCapabilityInstances[K] | undefined {
  return runtimeCapabilities.get(name) as
    | RuntimeCapabilityInstances[K]
    | undefined;
}

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

export function resetRuntimeCapability(name: RuntimeCapabilityName): void {
  runtimeCapabilities.delete(name);
  runtimeCapabilityDisposers.delete(name);
}

export async function disposeRuntimeCapabilities(): Promise<void> {
  const disposers = [...runtimeCapabilityDisposers.values()];

  for (const dispose of disposers) {
    await dispose();
  }

  runtimeCapabilities.clear();
  runtimeCapabilityDisposers.clear();
}
