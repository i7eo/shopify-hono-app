import { expect, vi } from "vitest";

export const runtimeConfig = {
  APP_RUNTIME: "node",
  APP_ENV: "test",
  APP_API_PREFIX: "api",
  APP__SERVER_PORT: 3000,
  APP__WEB_PORT: 3001,
  APP_DATABASE_PROVIDER: "postgres",
  SHOPIFY_APP_MODE: "embedded",
  SHOPIFY_APP_FRONTEND_TARGET: "backend",
  SHOPIFY_APP_KEY: "test_app_key",
  SHOPIFY_APP_SECRET: "test_app_secret",
  SHOPIFY_APP_URL: "https://app.example.com",
  SHOPIFY_API_VERSION: "2026-04",
  SCOPES: "read_products, write_products",
};

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
