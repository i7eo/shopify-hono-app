import { afterEach, describe, expect, it, vi } from "vitest";
import {
  disposeRuntimeCapabilities,
  requireCapability,
  setRuntimeCapability,
} from "@/app/runtime/capabilities";
import { createResourceScope } from "@/app/runtime/resources";

describe("resource scope", () => {
  it("memoizes a resource so the factory runs once per scope", async () => {
    const resource = { id: 1 };
    const factory = vi.fn(() => resource);
    const scope = createResourceScope();

    const first = await scope.resolve("database", factory);
    const second = await scope.resolve("database", factory);

    expect(first).toBe(second);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("disposes a resolved resource exactly once", async () => {
    const dispose = vi.fn();
    const scope = createResourceScope();
    await scope.resolve("database", () => ({}), dispose);

    await scope.dispose();
    await scope.dispose();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("runs disposers LIFO and isolates a failing one", async () => {
    const order: string[] = [];
    const logger = { error: vi.fn() };
    const scope = createResourceScope(logger);

    scope.add(() => order.push("first"));
    scope.add(() => {
      throw new Error("boom");
    });
    scope.add(() => order.push("third"));

    await scope.dispose();

    // LIFO: third runs, the throwing one is logged not rethrown, then first.
    expect(order).toEqual(["third", "first"]);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});

describe("requireCapability", () => {
  afterEach(() => disposeRuntimeCapabilities());

  it("throws when the capability is not registered", () => {
    expect(() => requireCapability("databaseFactory")).toThrow(
      "Runtime capability is not registered: databaseFactory",
    );
  });

  it("returns the registered capability", () => {
    const factory = vi.fn();
    setRuntimeCapability("databaseFactory", factory as never);

    expect(requireCapability("databaseFactory")).toBe(factory);
  });
});
