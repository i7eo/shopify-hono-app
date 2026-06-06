import { getRuntimeConfig, type RuntimeConfig } from "@/infra/env";
import { providerDisposers, providers } from "./constants";

type EnvProviderOptions = {
  merge?: boolean;
  override?: boolean;
};

let envProviderRawEnv: Record<string, unknown> | undefined;

/**
 * Get the validated runtime env provider.
 * Bootstrap calls pass process.env, while route calls can merge latest bindings with { merge: true }.
 */
export function getEnvProvider(
  rawEnv: unknown,
  options: EnvProviderOptions = {},
): RuntimeConfig {
  const shouldSetup =
    options.override || options.merge || !providers.has("env");

  if (shouldSetup) {
    const nextRawEnv = rawEnv ?? ({} as any);
    envProviderRawEnv = options.merge
      ? { ...envProviderRawEnv, ...nextRawEnv }
      : nextRawEnv;

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
