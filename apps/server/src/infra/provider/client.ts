import { getSafeProcessEnv } from "@/app/runtime/process/utils";
import { createClient } from "@/infra/http/client";
import { providerDisposers, providers } from "./constants";
import { getEnvProvider } from "./env";
import type { RuntimeConfig } from "@/infra/env";

export type HttpClient = ReturnType<typeof createClient>;

let clientProviderSignature: string | undefined;

export function getClientProvider(config?: RuntimeConfig): HttpClient {
  const clientConfig = config ?? getCurrentEnvProvider();

  const signature = getClientProviderSignature(clientConfig);
  if (!providers.has("client") || clientProviderSignature !== signature) {
    setClientProvider(createClient(clientConfig), signature);
  }

  return providers.get("client") as HttpClient;
}

export function resetClientProvider() {
  providers.delete("client");
  providerDisposers.delete("client");
  clientProviderSignature = undefined;
}

function setClientProvider(client: HttpClient, signature: string) {
  providers.set("client", client);
  clientProviderSignature = signature;
  providerDisposers.set("client", resetClientProvider);
}

function getCurrentEnvProvider(): RuntimeConfig {
  const env = providers.get("env") as RuntimeConfig | undefined;

  if (env) return env;

  return getEnvProvider(getSafeProcessEnv());
}

function getClientProviderSignature(config: RuntimeConfig): string {
  return [config.APP_RUNTIME, config.APP_ENV, config.APP_REQUEST_TIMEOUT]
    .map((value) => String(value ?? ""))
    .join(":");
}
