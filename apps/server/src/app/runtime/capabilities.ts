import type { RuntimeConfig } from "@/infra/env";
import type { LoggerSetupOptions } from "@/infra/logger/shared";
import type { AppEnv } from "@/types";
import type { Session } from "@shopify/shopify-api";
import type { Context } from "hono";

export type RuntimeLoggerSetup = (
  config: RuntimeConfig,
  options: LoggerSetupOptions,
) => Promise<void>;
export type ProcessDiskHealthChecker = () => Promise<string>;
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
export type ShopifySessionStorageFactory = (
  context: Context<AppEnv>,
) => ShopifySessionStorage;

export interface RuntimeCapabilityInstances {
  runtimeLoggerSetup: RuntimeLoggerSetup;
  processDiskHealthChecker: ProcessDiskHealthChecker;
  runtimeEnvSourceResolver: RuntimeEnvSourceResolver;
  shopifySessionStorageFactory: ShopifySessionStorageFactory;
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
