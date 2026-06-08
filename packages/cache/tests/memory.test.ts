import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryCache } from "../src/drivers/memory";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("MemoryCache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("connects, stores, reads, checks, deletes, clears, and disposes values", async () => {
    const cache = new MemoryCache({ keyPrefix: "shop" });

    expect(cache.isConnected).toBe(false);
    await cache.connect();
    expect(cache.isConnected).toBe(true);

    await cache.set("settings", { currency: "USD" });
    expect(await cache.has("settings")).toBe(true);
    expect(await cache.get<{ currency: string }>("settings")).toEqual({
      currency: "USD",
    });

    await cache.del("settings");
    expect(await cache.has("settings")).toBe(false);
    expect(await cache.get("settings")).toBeUndefined();

    await cache.set("a", 1);
    await cache.set("b", 2);
    await cache.clear();
    expect(await cache.has("a")).toBe(false);
    expect(await cache.has("b")).toBe(false);

    await cache.set("c", 3);
    await cache.dispose();
    expect(cache.isConnected).toBe(false);
    expect(await cache.has("c")).toBe(false);
  });

  it("expires values by default TTL and per-write TTL", async () => {
    const cache = new MemoryCache({ ttl: 10 });

    await cache.set("default", "value");
    await cache.set("custom", "value", { ttl: 40 });

    await wait(5);
    expect(await cache.has("default")).toBe(true);
    expect(await cache.has("custom")).toBe(true);

    await wait(15);
    expect(await cache.has("default")).toBe(false);
    expect(await cache.has("custom")).toBe(true);

    await wait(30);
    expect(await cache.has("custom")).toBe(false);
  });

  it("honors max size eviction using serialized value size", async () => {
    const cache = new MemoryCache({ maxSize: 8 });

    await cache.set("a", "1234");
    await cache.set("b", "5678");

    expect(await cache.has("a")).toBe(false);
    expect(await cache.has("b")).toBe(true);
  });

  it("throws for invalid constructor and per-write TTL values", () => {
    expect(() => new MemoryCache({ ttl: 0 })).toThrow(
      "Cache ttl must be a positive finite number in ms",
    );

    const cache = new MemoryCache();
    expect(() => cache.set("key", "value", { ttl: -1 })).toThrow(
      "Cache ttl must be a positive finite number in ms",
    );
  });
});
