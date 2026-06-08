import { describe, expect, it } from "vitest";
import {
  buildCacheKey,
  deserializeCacheValue,
  estimateCacheValueSize,
  normalizeCacheKeyPrefix,
  serializeCacheValue,
} from "../src/utils";

describe("cache utils", () => {
  it("builds cache keys with optional prefixes", () => {
    expect(buildCacheKey("cache:", "user:1")).toBe("cache:user:1");
    expect(buildCacheKey("", "user:1")).toBe("user:1");
  });

  it("serializes and deserializes cache values", () => {
    const serialized = serializeCacheValue({ id: 1, name: "Ada" });

    expect(serialized).toBe('{"id":1,"name":"Ada"}');
    expect(
      deserializeCacheValue<{ id: number; name: string }>(serialized),
    ).toEqual({
      id: 1,
      name: "Ada",
    });
    expect(deserializeCacheValue(undefined)).toBeUndefined();
  });

  it("rejects non JSON-serializable values", () => {
    expect(() => serializeCacheValue(undefined)).toThrow(
      "Cache value must be JSON serializable",
    );
  });

  it("estimates stored value size by string length", () => {
    expect(estimateCacheValueSize("cached")).toBe(6);
  });

  it("normalizes cache key prefixes", () => {
    expect(normalizeCacheKeyPrefix()).toBe("cache:");
    expect(normalizeCacheKeyPrefix("shop")).toBe("shop:");
    expect(normalizeCacheKeyPrefix("shop:")).toBe("shop:");
    expect(normalizeCacheKeyPrefix("")).toBe("");
  });
});
