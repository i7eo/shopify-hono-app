import { applyJsonSecurity, parseJsonSafely } from "@shamt/oh-my-fetch/json";
import { describe, expect, it } from "vitest";
import {
  sanitizeJsonValue,
  sanitizeJsonValueShallow,
} from "../src/security/sanitize";

describe("JSON security", () => {
  it("parses JSON and recursively removes prototype-pollution keys in strict mode", () => {
    const parsed = parseJsonSafely(
      '{"safe":true,"__proto__":{"polluted":true},"nested":{"constructor":{"bad":true},"ok":1}}',
    );

    expect(parsed).toEqual({
      safe: true,
      nested: { ok: 1 },
    });
    expect(({} as any).polluted).toBeUndefined();
  });

  it("supports shallow and off sanitization modes", () => {
    const value = {
      constructor: { top: true },
      nested: { constructor: { kept: true }, ok: true },
    };

    expect(applyJsonSecurity(value, "shallow")).toEqual({
      nested: { constructor: { kept: true }, ok: true },
    });
    expect(applyJsonSecurity(value, "off")).toBe(value);
  });

  it("exposes recursive and shallow sanitizers", () => {
    expect(
      sanitizeJsonValue({
        prototype: { bad: true },
        nested: { __proto__: { bad: true }, ok: true },
      }),
    ).toEqual({ nested: { ok: true } });
    expect(
      sanitizeJsonValueShallow({
        prototype: { bad: true },
        nested: { constructor: { kept: true } },
      }),
    ).toEqual({ nested: { constructor: { kept: true } } });
  });

  it("throws syntax errors for invalid JSON", () => {
    expect(() => parseJsonSafely("not-json")).toThrow("Invalid JSON response");
  });
});
