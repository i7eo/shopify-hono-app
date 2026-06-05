import runtimeLogger, { dispose, setupLogger } from "@/infra/logger";
import { providerDisposers, providers } from "./constants";
import type { RuntimeConfig } from "@/configs/runtime";

export async function getLoggerProvider(config: RuntimeConfig) {
  if (!providers.has("logger")) {
    await setupLogger(config, { reset: true });

    providers.set("logger", runtimeLogger);
    providerDisposers.set("logger", async () => {
      await dispose();
    });
  }

  return providers.get("logger") as typeof runtimeLogger;
}
