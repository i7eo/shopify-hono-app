import { getRuntimeConfig, type RuntimeConfig } from "@/infra/env";
import { providerDisposers, providers } from "./constants";

type EnvProviderOptions = {
  merge?: boolean;
  override?: boolean;
};

let envProviderRawEnv: Record<string, unknown> | undefined;
let envProviderSignature: string | undefined;

/**
 * Get the validated runtime env provider.
 * Bootstrap calls pass process.env, while route calls can merge latest bindings with { merge: true }.
 */
export function getEnvProvider(
  rawEnv: unknown,
  options: EnvProviderOptions = {},
): RuntimeConfig {
  const nextRawEnv = rawEnv ?? ({} as any);
  const nextMergedRawEnv = options.merge
    ? { ...envProviderRawEnv, ...nextRawEnv }
    : nextRawEnv;
  const nextSignature = getEnvProviderSignature(nextMergedRawEnv);
  const shouldSetup =
    options.override ||
    !providers.has("env") ||
    envProviderSignature !== nextSignature;

  if (shouldSetup) {
    envProviderRawEnv = nextMergedRawEnv;
    envProviderSignature = nextSignature;
    setEnvProvider(getRuntimeConfig(envProviderRawEnv));
  }

  return providers.get("env") as RuntimeConfig;
}

/**
 * Remove the env provider and its raw env snapshot from the registry.
 * Use this when disposing providers or resetting tests.
 */
export function resetEnvProvider() {
  providers.delete("env");
  providerDisposers.delete("env");
  envProviderRawEnv = undefined;
  envProviderSignature = undefined;
}

/**
 * Store a validated runtime env and register its disposer.
 * The disposer removes both the provider map entry and the disposer entry.
 */
function setEnvProvider(config: RuntimeConfig) {
  providers.set("env", config);
  providerDisposers.set("env", () => {
    resetEnvProvider();
  });
}

function getEnvProviderSignature(config: Record<string, unknown>): string {
  return [
    config.APP_RUNTIME,
    config.APP_ENV,
    config.SHOPIFY_APP_KEY,
    config.SHOPIFY_APP_URL,
    config.SHOPIFY_API_VERSION,
    config.SCOPES,
    config.sofary ? "sofary" : "",
  ]
    .map((value) => String(value ?? ""))
    .join(":");
}
