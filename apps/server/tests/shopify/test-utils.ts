import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import { expect, vi } from "vitest";
import { getRuntimeConfig } from "@/infra/env";

export const runtimeConfig = getRuntimeConfig({
  APP_NAME: "Test App",
  APP_RUNTIME: "node",
  APP_ENV: "test",
  APP_API_PREFIX: "api",
  APP_REQUEST_TIMEOUT: 30_000,
  APP_LOCALE: "en",
  APP_USE_CLUSTER: false,
  APP__SERVER_PORT: 3000,
  APP__WEB_PORT: 3001,
  APP_LOGGER_DIR: "logs",
  APP_LOGGER_LEVEL: "info",
  APP_CACHE_EXPIRE: 60,
  APP_CACHE_MAX_SIZE: 100,
  APP_BUCKET_PROVIDER: "memory",
  APP_BUCKET_R2_BINDING: "test_r2",
  APP_BUCKET_R2_NAME: "test-r2",
  APP_DATABASE_D1_BINDING: "test_d1",
  APP_DATABASE_D1_ID: "test-d1-id",
  APP_DATABASE_D1_NAME: "test-d1",
  APP_DATABASE_PROVIDER: DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES,
  APP_HYPERDRIVER_BINDING: "test_hyperdrive",
  APP_HYPERDRIVER_ID: "test-hyperdrive-id",
  APP_FILE_DIR: "files",
  APP_FILE_EXPIRE: 1000 * 60 * 60 * 24,
  APP_FILE_MAX_SIZE: 1024 * 1024 * 10,
  APP_FILE_UPLOAD_MULTIPLE_SIZE: 10,
  APP_FILE_UPLOAD_TIMEOUT: 1000 * 60 * 5,
  SHOPIFY_APP_MODE: "embedded",
  SHOPIFY_APP_FRONTEND_TARGET: "backend",
  SHOPIFY_APP_KEY: "test_app_key",
  SHOPIFY_APP_SECRET: "test_app_secret",
  SHOPIFY_APP_URL: "https://app.example.com",
  SHOPIFY_API_VERSION: "2026-04",
  SCOPES: "read_products, write_products",
});

type TestLogger = {
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export const logger: TestLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

type MockContextOptions = {
  headers?: HeadersInit;
  method?: string;
  url?: string;
  body?: BodyInit | null;
  vars?: Record<string, unknown>;
  env?: Record<string, unknown>;
};

export function createMockContext(options: MockContextOptions = {}) {
  const headers = new Headers(options.headers);
  const store: Record<string, unknown> = {
    runtimeEnv: runtimeConfig,
    runtimeLogger: logger,
    requestId: "req_test",
    ...options.vars,
  };
  const raw = new Request(options.url ?? "https://app.example.com/test", {
    method: options.method ?? "GET",
    headers,
    body: options.body,
  });

  return {
    env: options.env ?? {},
    req: {
      raw,
      header: (name: string) => headers.get(name) ?? undefined,
      query: (name: string) =>
        new URL(raw.url).searchParams.get(name) ?? undefined,
    },
    get: (key: string) => store[key],
    set: (key: string, value: unknown) => {
      store[key] = value;
    },
    var: store,
  };
}

export function expectAppError(
  error: unknown,
  status: number,
  message: string,
) {
  expect(error).toMatchObject({
    name: "AppError",
    status,
    message,
  });
}
