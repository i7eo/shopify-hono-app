import { providerDisposers, providers } from "./constants";

export async function disposeProviders(): Promise<void> {
  for (const dispose of providerDisposers.values()) {
    await dispose();
  }

  providers.clear();
  providerDisposers.clear();
}

export * from "./logger";
