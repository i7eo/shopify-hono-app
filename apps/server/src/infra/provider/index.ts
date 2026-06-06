import { providerDisposers, providers } from "./constants";

/**
 * Dispose every registered provider and clear the provider registry.
 * Call this during application shutdown or test teardown.
 */
export async function disposeProviders(): Promise<void> {
  for (const dispose of providerDisposers.values()) {
    await dispose();
  }

  providers.clear();
  providerDisposers.clear();
}

export * from "./env";
export * from "./logger";
