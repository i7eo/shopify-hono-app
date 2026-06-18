import { internalServerError } from "@/shared/exceptions";
import type { RuntimeConfig } from "@/infra/env";

type D1HttpQueryInput = {
  params?: unknown[];
  sql: string;
};
type D1HttpResult = {
  meta?: Record<string, unknown>;
  results?: Record<string, unknown>[];
  success?: boolean;
};
type D1HttpResponse = D1HttpResult | D1HttpResult[];
/**
 * Creates a D1-compatible client that talks to Cloudflare D1 over HTTP.
 * This lets Node runtime reuse drizzle-orm/d1 without a Worker binding.
 */
export function createProcessD1HttpClient(config: RuntimeConfig): D1Database {
  return new ProcessD1HttpDatabase(
    getD1HttpConfig(config),
  ) as unknown as D1Database;
}

type ProcessD1HttpConfig = {
  accountId: string;
  databaseId: string;
  token: string;
};

class ProcessD1HttpDatabase {
  constructor(private readonly config: ProcessD1HttpConfig) {}

  prepare(query: string): D1PreparedStatement {
    return new ProcessD1HttpPreparedStatement(this.config, query) as never;
  }

  async batch<T = unknown>(
    statements: D1PreparedStatement[],
  ): Promise<D1Result<T>[]> {
    const queries = statements.map((statement) =>
      toPreparedStatementPayload(statement),
    );
    const response = await queryD1Http(this.config, queries);
    const results = Array.isArray(response) ? response : [response];

    return results.map(toD1Result) as D1Result<T>[];
  }

  async exec(query: string): Promise<D1ExecResult> {
    const response = await queryD1Http(this.config, { sql: query });
    const result = getFirstD1HttpResult(response);

    return {
      count: Number(result?.meta?.rows_written ?? result?.meta?.changes ?? 0),
      duration: Number(result?.meta?.duration ?? 0),
    };
  }

  dump(): Promise<ArrayBuffer> {
    throw internalServerError("D1 HTTP dump is not implemented", {
      expose: true,
    });
  }

  withSession(): D1DatabaseSession {
    return this as unknown as D1DatabaseSession;
  }
}

class ProcessD1HttpPreparedStatement {
  private readonly parameters: unknown[];

  constructor(
    private readonly config: ProcessD1HttpConfig,
    private readonly query: string,
    parameters: unknown[] = [],
  ) {
    this.parameters = parameters;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    return new ProcessD1HttpPreparedStatement(
      this.config,
      this.query,
      values,
    ) as never;
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const { results } = await this.all<Record<string, unknown>>();
    const first = results[0];
    if (!first) return null;
    if (colName) return (first as Record<string, unknown>)[colName] as T;

    return first as T;
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return toD1Result<T>(
      getFirstD1HttpResult(
        await queryD1Http(
          this.config,
          toQueryInput(this.query, this.parameters),
        ),
      ),
    );
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return await this.run<T>();
  }

  async raw<T = unknown[]>(options?: {
    columnNames?: boolean;
  }): Promise<T[] | [string[], ...T[]]> {
    const { results } = await this.all<Record<string, unknown>>();
    const rows = results.map((row) => Object.values(row) as T);

    if (options?.columnNames) {
      const columnNames = Object.keys(results[0] ?? {});
      return [columnNames, ...rows];
    }

    return rows;
  }

  getPayload(): D1HttpQueryInput {
    return toQueryInput(this.query, this.parameters);
  }
}

function getFirstD1HttpResult(response: D1HttpResponse): D1HttpResult {
  return Array.isArray(response) ? (response[0] ?? {}) : response;
}

function toPreparedStatementPayload(
  statement: D1PreparedStatement,
): D1HttpQueryInput {
  if (
    statement &&
    typeof statement === "object" &&
    "getPayload" in statement &&
    typeof statement.getPayload === "function"
  ) {
    return statement.getPayload() as D1HttpQueryInput;
  }

  throw internalServerError("Unsupported D1 prepared statement", {
    expose: true,
  });
}

function toQueryInput(sql: string, params: unknown[]): D1HttpQueryInput {
  return params.length > 0 ? { params, sql } : { sql };
}

async function queryD1Http(
  config: ProcessD1HttpConfig,
  query: D1HttpQueryInput | D1HttpQueryInput[],
): Promise<D1HttpResponse> {
  const response = await fetch(getD1QueryUrl(config), {
    body: JSON.stringify(query),
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json().catch(() => undefined)) as
    | {
        errors?: unknown;
        result?: D1HttpResponse;
        success?: boolean;
      }
    | undefined;

  if (!response.ok || data?.success === false || !data?.result) {
    throw internalServerError("Cloudflare D1 HTTP query failed", {
      details: {
        errors: data?.errors,
        status: response.status,
      },
      expose: true,
    });
  }

  return data.result;
}

function toD1Result<T = unknown>(result: D1HttpResult): D1Result<T> {
  return {
    meta: (result.meta ?? {}) as D1Meta & Record<string, unknown>,
    results: (result.results ?? []) as T[],
    success: true,
  };
}

function getD1QueryUrl(config: ProcessD1HttpConfig): string {
  return `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;
}

function getD1HttpConfig(config: RuntimeConfig): ProcessD1HttpConfig {
  const missing = [
    [
      "APP_CLOUDFLARE_WORKER_ACCOUNT_ID",
      config.APP_CLOUDFLARE_WORKER_ACCOUNT_ID,
    ],
    ["APP_DATABASE_D1_ID", config.APP_DATABASE_D1_ID],
    ["APP_CLOUDFLARE_USER_TOKEN", config.APP_CLOUDFLARE_USER_TOKEN],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw internalServerError("D1 HTTP database config is incomplete", {
      details: { missing },
      expose: true,
    });
  }

  return {
    accountId: config.APP_CLOUDFLARE_WORKER_ACCOUNT_ID!,
    databaseId: config.APP_DATABASE_D1_ID!,
    token: config.APP_CLOUDFLARE_USER_TOKEN!,
  };
}
