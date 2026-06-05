import type { Logger } from "@/infra/logger";

export interface ProviderInstances {
  logger: Logger;
}

export type ProviderName = keyof ProviderInstances;
export type ProviderDisposer = () => Promise<void> | void;

export const providers = new Map<
  ProviderName,
  ProviderInstances[ProviderName]
>();
export const providerDisposers = new Map<ProviderName, ProviderDisposer>();
