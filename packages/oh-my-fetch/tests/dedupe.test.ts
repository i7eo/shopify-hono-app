import { describe, expect, it } from "vitest";
import { createDedupeManager } from "../src/lifecycle/dedupe";
import { RequestScope } from "../src/lifecycle/disposable";
import type { Options } from "ky";

/**
 * Regression coverage for the request lifecycle invariant behind issue #3:
 * `HttpClient.request` calls `scope.dispose()` in a `finally`, so a request's
 * dedupe entry must be removed on every path — including when the request
 * throws. These tests exercise the scope cleanup directly.
 */
describe("dedupe manager scope cleanup", () => {
  it("removes the pending entry when the request scope disposes", () => {
    const manager = createDedupeManager();
    const scope = new RequestScope();
    const options: Options = { method: "GET" };

    manager.register("https://example.com/users", options, true, scope);
    const signal = options.signal!;

    // Simulates the request() `finally { scope.dispose() }` running.
    scope.dispose();
    // Simulates a later client-wide dispose: with the entry cleared, the
    // settled request's controller must not be aborted retroactively.
    manager.abortAll();

    expect(signal.aborted).toBe(false);
  });

  it("still tracks the entry until the scope disposes", () => {
    const manager = createDedupeManager();
    const scope = new RequestScope();
    const options: Options = { method: "GET" };

    manager.register("https://example.com/users", options, true, scope);
    const signal = options.signal!;

    // Without scope.dispose(), the entry is still live and abortAll reaches it.
    manager.abortAll();

    expect(signal.aborted).toBe(true);
  });
});
