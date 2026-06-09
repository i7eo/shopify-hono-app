import runtimeLogger, {
  dispose,
  setupBootstrapLogger,
  setupLogger,
} from "@/infra/logger";
import { providerDisposers, providers } from "./constants";
import type { RuntimeConfig } from "@/infra/env";

type LoggerProviderOptions = {
  override?: boolean;
};

let loggerProviderSignature: string | undefined;

/**
 * Get the logger provider for bootstrap or runtime phases.
 * Call without config for bootstrap; call with runtime config inside route middleware.
 */
export async function getLoggerProvider(
  config?: RuntimeConfig,
  options: LoggerProviderOptions = {},
) {
  if (!config) {
    if (!providers.has("logger")) {
      await setupBootstrapLogger();
      setLoggerProvider("bootstrap");
    }

    return providers.get("logger") as typeof runtimeLogger;
  }

  const signature = getLoggerProviderSignature(config);
  const shouldSetup =
    options.override ||
    !providers.has("logger") ||
    loggerProviderSignature !== signature;

  if (shouldSetup) {
    await setupLogger(config, { reset: true });
    setLoggerProvider(signature);
  }

  return providers.get("logger") as typeof runtimeLogger;
}

/**
 * Remove the logger provider and reset its lifecycle phase.
 * This does not call LogTape dispose; the registered disposer handles that path.
 */
export function resetLoggerProvider() {
  providers.delete("logger");
  providerDisposers.delete("logger");
  loggerProviderSignature = undefined;
}

/**
 * Store the shared logger facade and register the LogTape disposer.
 * The disposer also clears the provider map and logger phase.
 */
function setLoggerProvider(signature: string) {
  providers.set("logger", runtimeLogger);
  loggerProviderSignature = signature;
  providerDisposers.set("logger", async () => {
    await dispose();
    resetLoggerProvider();
  });
}

function getLoggerProviderSignature(config: RuntimeConfig): string {
  return [
    config.APP_RUNTIME,
    config.APP_ENV,
    config.APP_LOGGER_DIR,
    config.APP_LOGGER_LEVEL,
    config.APP_LOGGER_EXPIRE,
    config.APP_LOGGER_MAX_SIZE,
  ]
    .map((value) => String(value ?? ""))
    .join(":");
}
