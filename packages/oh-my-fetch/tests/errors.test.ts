import { describe, expect, it } from "vitest";
import {
  HttpRequestError,
  normalizeHttpError,
  redactHttpRequestConfig,
} from "../src/errors";

describe("HttpRequestError", () => {
  it("stores metadata and redacts request config", () => {
    const cause = new Error("cause");
    const error = new HttpRequestError("Failed", {
      kind: "network",
      code: "NETWORK_ERROR",
      status: 500,
      data: { a: 1 },
      config: {
        method: "POST",
        headers: { Authorization: "secret", "x-id": "1" },
        query: { token: "secret", page: 1 },
        body: { password: "secret" },
      },
      cause,
    });

    expect(error.name).toBe("HttpRequestError");
    expect(error.kind).toBe("network");
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.status).toBe(500);
    expect(error.data).toEqual({ a: 1 });
    expect(error.cause).toBe(cause);
    expect(error.config?.body).toBe("[redacted]");
    expect(error.config?.headers?.get("authorization")).toBe("[redacted]");
    expect((error.config?.query as URLSearchParams).get("token")).toBe(
      "[redacted]",
    );
  });
});

describe("redactHttpRequestConfig", () => {
  it("redacts sensitive headers, query params, and body values", () => {
    const redacted = redactHttpRequestConfig({
      method: "GET",
      headers: [
        ["cookie", "session=secret"],
        ["x-trace-id", "trace"],
      ],
      query: "api_key=secret&page=1",
      body: "secret",
      responseType: "json",
      timestamp: true,
    });

    expect(redacted.method).toBe("GET");
    expect(redacted.headers?.get("cookie")).toBe("[redacted]");
    expect(redacted.headers?.get("x-trace-id")).toBe("trace");
    expect((redacted.query as URLSearchParams).get("api_key")).toBe(
      "[redacted]",
    );
    expect(redacted.body).toBe("[redacted]");
  });
});

describe("normalizeHttpError", () => {
  it("returns existing HttpRequestError values unchanged", () => {
    const error = new HttpRequestError("Already normalized");

    expect(normalizeHttpError(error, {})).toBe(error);
  });

  it("normalizes abort, generic Error, and unknown values", () => {
    const abort = new DOMException("stop", "AbortError");
    expect(normalizeHttpError(abort, {}).kind).toBe("abort");

    const error = normalizeHttpError(new Error("Generic"), {});
    expect(error.kind).toBe("unknown");
    expect(error.message).toBe("Generic");

    const unknown = normalizeHttpError("raw", {});
    expect(unknown.kind).toBe("unknown");
    expect(unknown.data).toBe("raw");
  });
});
