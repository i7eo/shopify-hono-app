import { DEFAULT_REQUEST_TIMEOUT } from "@shamt/envs";
import { createHttpClient } from "@shamt/ofetch";

export function createClient() {
  return createHttpClient({
    timeout: DEFAULT_REQUEST_TIMEOUT,
    retry: { limit: 0 },
    defaults: {
      validateBusinessStatus: false,
    },
  });
}
