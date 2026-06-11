import { getSafeProcessEnv } from "@/app/runtime/process/utils/process";
import { getRuntimeConfig, type RuntimeConfig } from "@/infra/env";
import { providerDisposers, providers } from "./constants";

type EnvProviderOptions = {
  override?: boolean;
};

let envProviderSignature: string | undefined;

/**
 * Get the validated runtime env provider.
 * If rawEnv is omitted, process.env is used. Runtime middleware passes request
 * bindings explicitly so isolate environments can refresh per request.
 * Pass { override: true } to use rawEnv verbatim.
 */
export function getEnvProvider(
  rawEnv?: unknown,
  options: EnvProviderOptions = {},
): RuntimeConfig {
  const nextRawEnv = (rawEnv ?? {}) as Record<string, unknown>;
  const effectiveRawEnv = options.override
    ? nextRawEnv
    : { ...getSafeProcessEnv(), ...nextRawEnv };

  const signature = getEnvProviderSignature(effectiveRawEnv);

  if (!providers.has("env") || envProviderSignature !== signature) {
    setEnvProvider(getRuntimeConfig(effectiveRawEnv), signature);
  }

  return providers.get("env") as RuntimeConfig;
}

/**
 * Remove the env provider and its signature from the registry.
 * Use this when disposing providers or resetting tests.
 */
export function resetEnvProvider() {
  providers.delete("env");
  providerDisposers.delete("env");
  envProviderSignature = undefined;
}

/**
 * Store a validated runtime env and register its disposer.
 * The disposer removes both the provider map entry and the disposer entry.
 */
function setEnvProvider(config: RuntimeConfig, signature: string) {
  providers.set("env", config);
  envProviderSignature = signature;
  providerDisposers.set("env", () => {
    resetEnvProvider();
  });
}

/**
 * Builds a stable cache signature from env fields that change runtime behavior.
 */
function getEnvProviderSignature(config: Record<string, unknown>): string {
  return [
    config.APP_RUNTIME,
    config.APP_ENV,
    config.APP_LOGGER_EXPIRE,
    config.APP__SERVER_PORT,
    config.APP__WEB_PORT,
    config.APP_REQUEST_TIMEOUT,
    config.SHOPIFY_APP_MODE,
    config.SHOPIFY_APP_FRONTEND_TARGET,
    config.SHOPIFY_APP_KEY,
    config.SHOPIFY_APP_URL,
    config.SHOPIFY_API_VERSION,
    config.SCOPES,
    config.sofary ? "sofary" : "",
  ]
    .map((value) => String(value ?? ""))
    .join(":");
}
