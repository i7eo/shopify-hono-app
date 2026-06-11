import { createHttpClient } from "@shamt/oh-my-fetch/client";
import { HttpRequestError } from "@shamt/oh-my-fetch/errors";
import {
  DEFAULT_APP_API_PREFIX,
  DEFAULT_REQUEST_TIMEOUT,
} from "@/utils/public-env";

export { HttpRequestError };

export type Client = ReturnType<typeof createHttpClient>;
export type ApiClient = ReturnType<Client["extend"]>;

/**
 * Creates the base browser HTTP client with shared timeout and no retries.
 */
export function createClient() {
  return createHttpClient({
    timeout: DEFAULT_REQUEST_TIMEOUT,
    retry: { limit: 0 },
  });
}

/**
 * Creates an API client scoped to the configured backend API prefix.
 */
export function createApiClient(baseClient: Client = createClient()) {
  return baseClient.extend({
    prefix: `/${DEFAULT_APP_API_PREFIX}`,
  });
}

export const client = createClient();
export const apiClient = createApiClient(client);
