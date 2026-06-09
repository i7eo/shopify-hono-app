import { describe, expect, it } from "vitest";
import {
  createHttpClient,
  HTTP_METHODS,
  httpClient,
  HttpClient,
  HttpRequestError,
  RESPONSE_BODY_TYPES,
} from "../src";

describe("package entry", () => {
  it("re-exports runtime APIs", () => {
    expect(createHttpClient()).toBeInstanceOf(HttpClient);
    expect(httpClient).toBeInstanceOf(HttpClient);
    expect(new HttpRequestError("Failed")).toBeInstanceOf(Error);
    expect(HTTP_METHODS).toContain("GET");
    expect(RESPONSE_BODY_TYPES).toContain("json");
  });
});
