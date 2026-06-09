import { createHttpClient } from "@shamt/oh-my-fetch";
import type { RuntimeConfig } from "@/infra/env";

type ClientConfig = Pick<RuntimeConfig, "APP_REQUEST_TIMEOUT">;

export function createClient(config: ClientConfig) {
  return createHttpClient({
    timeout: config.APP_REQUEST_TIMEOUT,
    retry: { limit: 0 },
    defaults: {
      validateBusinessStatus: false,
    },
  });
}
