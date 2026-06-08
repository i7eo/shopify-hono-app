import { DEFAULT_CACHE_MAX_SIZE } from "@shamt/envs";
import { describe, expect, it } from "vitest";
import {
  createCache,
  DEFAULT_CACHE_KEY_PREFIX,
  DEFAULT_CACHE_MAX_SIZE as EXPORTED_DEFAULT_CACHE_MAX_SIZE,
  MemoryCache,
} from "../src";

describe("cache package entry and factory", () => {
  it("exports constants", () => {
    expect(DEFAULT_CACHE_KEY_PREFIX).toBe("cache:");
    expect(EXPORTED_DEFAULT_CACHE_MAX_SIZE).toBe(DEFAULT_CACHE_MAX_SIZE);
  });

  it("creates the default memory cache", async () => {
    const cache = createCache({ keyPrefix: "factory" });

    expect(cache).toBeInstanceOf(MemoryCache);
    await cache.set("key", "value");
    await expect(cache.get("key")).resolves.toBe("value");
  });
});
