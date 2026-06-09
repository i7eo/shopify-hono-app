import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendTimestamp,
  createSearchParams,
  createUrlEncodedBody,
  normalizeRequestData,
} from "../src/utils";
import { HTTP_METHODS, RESPONSE_BODY_TYPES } from "../src/utils/constants";

describe("utils constants", () => {
  it("exports supported HTTP methods and response body types", () => {
    expect(HTTP_METHODS).toEqual([
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "HEAD",
    ]);
    expect(RESPONSE_BODY_TYPES).toEqual([
      "json",
      "text",
      "blob",
      "arrayBuffer",
      "formData",
      "response",
    ]);
  });
});

describe("createSearchParams", () => {
  it("returns undefined for empty input", () => {
    expect(createSearchParams()).toBeUndefined();
  });

  it("creates params from strings, URLSearchParams, tuples, and objects", () => {
    expect(createSearchParams("?a=1&b=2")?.toString()).toBe("a=1&b=2");
    expect(createSearchParams(new URLSearchParams("a=1"))?.toString()).toBe(
      "a=1",
    );
    expect(createSearchParams([["a", 1]])?.toString()).toBe("a=1");

    const date = new Date(2024, 0, 2, 3, 4, 5);
    expect(
      createSearchParams({
        a: " x ",
        b: [1, null, undefined, true],
        date,
      })?.toString(),
    ).toBe(
      "a=+x+&b%5B%5D=1&b%5B%5D=null&b%5B%5D=true&date=2024-01-02+03%3A04%3A05",
    );
  });
});

describe("appendTimestamp", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds a timestamp when enabled and leaves params untouched when disabled", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_704_164_645_000);

    expect(appendTimestamp(undefined)?.toString()).toBe("_t=1704164645000");
    expect(appendTimestamp(new URLSearchParams("a=1"), false)?.toString()).toBe(
      "a=1",
    );
    expect(appendTimestamp(new URLSearchParams("_t=old&a=1"))?.toString()).toBe(
      "_t=1704164645000&a=1",
    );
  });
});

describe("normalizeRequestData", () => {
  it("trims strings and formats Date and Day.js-like values recursively", () => {
    const source = {
      name: " Ada ",
      date: new Date(2024, 0, 2, 3, 4, 5),
      nested: [" value ", { dayjs: { format: () => "formatted" } }],
    };

    expect(normalizeRequestData(source)).toEqual({
      name: "Ada",
      date: "2024-01-02 03:04:05",
      nested: ["value", { dayjs: "formatted" }],
    });
    expect(source.name).toBe(" Ada ");
  });

  it("throws for circular request data", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => normalizeRequestData(circular)).toThrow(
      "Circular request data is not supported",
    );
  });
});

describe("createUrlEncodedBody", () => {
  it("serializes strings, arrays, objects, and URLSearchParams", () => {
    expect(createUrlEncodedBody("a=1").toString()).toBe("a=1");
    expect(createUrlEncodedBody(new URLSearchParams("a=1")).toString()).toBe(
      "a=1",
    );
    expect(createUrlEncodedBody(["a", "b"]).toString()).toBe("0=a&1=b");
    expect(createUrlEncodedBody({ a: 1, b: ["x", "y"] }).toString()).toBe(
      "a=1&b%5B%5D=x&b%5B%5D=y",
    );
    expect(createUrlEncodedBody(null).toString()).toBe("");
  });
});
