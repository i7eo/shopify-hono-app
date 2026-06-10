import { createHttpClient } from "@shamt/oh-my-fetch/client";
import type { RuntimeConfig } from "@/infra/env";

/**
 * Creates the server HTTP client from validated runtime configuration.
 */
export function createClient(config: RuntimeConfig) {
  return createHttpClient({
    prefix: config.APP_API_PREFIX,
    timeout: config.APP_REQUEST_TIMEOUT,
    retry: { limit: 0 },
  });
}
