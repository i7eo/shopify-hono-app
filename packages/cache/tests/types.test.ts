import { describe, expect, it } from "vitest";
import {
  Cache,
  CacheMethodNotImplementedError,
  normalizeCacheTtl,
} from "../src/types";

class EmptyCache extends Cache<Record<string, never>> {
  constructor() {
    super({});
  }
}

class TtlProbeCache extends Cache<Record<string, never>> {
  constructor(ttl?: number) {
    super({}, { ttl });
  }

  probe(ttl?: number) {
    return this.resolveTtl(ttl);
  }
}

describe("cache base types runtime", () => {
  it("throws standard not implemented errors for base methods", () => {
    const cache = new EmptyCache();

    expect(() => cache.set("key", "value")).toThrow(
      new CacheMethodNotImplementedError("EmptyCache", "set"),
    );
    expect(() => cache.get("key")).toThrow(
      "EmptyCache must implement Cache.get()",
    );
    expect(() => cache.del("key")).toThrow(
      "EmptyCache must implement Cache.del()",
    );
    expect(() => cache.has("key")).toThrow(
      "EmptyCache must implement Cache.has()",
    );
  });

  it("normalizes TTL values", () => {
    expect(normalizeCacheTtl()).toBeUndefined();
    expect(normalizeCacheTtl(1000)).toBe(1000);
    expect(() => normalizeCacheTtl(0)).toThrow(
      "Cache ttl must be a positive finite number in ms",
    );
    expect(() => normalizeCacheTtl(Number.POSITIVE_INFINITY)).toThrow(
      "Cache ttl must be a positive finite number in ms",
    );
  });

  it("resolves per-write TTL against the store default", () => {
    const withDefault = new TtlProbeCache(1000);
    const withoutDefault = new TtlProbeCache();

    expect(withDefault.probe()).toBe(1000);
    expect(withDefault.probe(250)).toBe(250);
    expect(withoutDefault.probe()).toBeUndefined();
    expect(() => withDefault.probe(-1)).toThrow(
      "Cache ttl must be a positive finite number in ms",
    );
  });
});
