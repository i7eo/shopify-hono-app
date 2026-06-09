import { providerDisposers, providers } from "./constants";

/**
 * Dispose every registered provider and clear the provider registry.
 * Call this during application shutdown or test teardown.
 */
export async function disposeProviders(): Promise<void> {
  const disposers = Array.from(providerDisposers.values());

  for (const dispose of disposers) {
    await dispose();
  }

  providers.clear();
  providerDisposers.clear();
}

export * from "./client";
export * from "./env";
export * from "./logger";
export * from "./shopify";
