import { afterEach, describe, expect, it, vi } from "vitest";
import { getTypeName, hashString, isSupport, randomValue } from "../src/base";

describe("base utilities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("coerces feature probe results to booleans", () => {
    expect(isSupport(() => "supported")).toBe(true);
    expect(isSupport(() => 0)).toBe(false);
  });

  it("returns runtime type names", () => {
    expect(getTypeName(null)).toBe("null");
    expect(getTypeName(1)).toBe("number");
    expect(getTypeName("value")).toBe("string");
    expect(getTypeName([])).toBe("array");
    expect(getTypeName(new Date("2024-01-01T00:00:00.000Z"))).toBe("date");
    expect(getTypeName(() => undefined)).toBe("function");
  });

  it("generates random strings from a provided dictionary", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.99);

    expect(randomValue(3, "abc")).toBe("abc");
  });

  it("hashes strings deterministically and honors the seed", () => {
    expect(hashString("shopify")).toBe(hashString("shopify"));
    expect(hashString("shopify", 1)).not.toBe(hashString("shopify", 2));
    expect(Number.isSafeInteger(hashString("shopify"))).toBe(true);
  });
});
