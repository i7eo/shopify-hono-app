import { createHttpClient } from "@shamt/oh-my-fetch";
import type { RuntimeConfig } from "@/infra/env";

export function createClient(config: RuntimeConfig) {
  return createHttpClient({
    prefix: config.APP_API_PREFIX,
    timeout: config.APP_REQUEST_TIMEOUT,
    retry: { limit: 0 },
  });
}
