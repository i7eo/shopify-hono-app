import runtimeLogger, {
  dispose,
  setupBootstrapLogger,
  setupLogger,
} from "@/infra/logger";
import { providerDisposers, providers } from "./constants";
import type { RuntimeConfig } from "@/infra/env";

type LoggerProviderPhase = "bootstrap" | "runtime";

type LoggerProviderOptions = {
  override?: boolean;
};

let loggerProviderPhase: LoggerProviderPhase | undefined;

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

  const shouldSetup =
    options.override ||
    !providers.has("logger") ||
    loggerProviderPhase !== "runtime";

  if (shouldSetup) {
    await setupLogger(config, { reset: true });

    setLoggerProvider("runtime");
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
  loggerProviderPhase = undefined;
}

/**
 * Store the shared logger facade and register the LogTape disposer.
 * The disposer also clears the provider map and logger phase.
 */
function setLoggerProvider(phase: LoggerProviderPhase) {
  providers.set("logger", runtimeLogger);
  providerDisposers.set("logger", async () => {
    await dispose();
    resetLoggerProvider();
  });
  loggerProviderPhase = phase;
}
