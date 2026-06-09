import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAllCookies,
  Cookies,
  createCookies,
  getCookieJSON,
  getCookieNames,
  hasCookie,
  jsonConverter,
  setCookieJSON,
} from "../src/cookie";

function stubBrowser(cookie = "") {
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { cookie });
}

describe("cookie utilities", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns empty values outside a browser-like runtime", () => {
    expect(Cookies.get()).toEqual({});
    expect(Cookies.get("theme")).toBeUndefined();
    expect(Cookies.set("theme", "dark")).toBe("");
  });

  it("reads a specific cookie and all cookies", () => {
    stubBrowser('theme=dark; spaced=a+b; quoted="hello%20world"; bad%XX=value');

    expect(Cookies.get("theme")).toBe("dark");
    expect(Cookies.get("missing")).toBeUndefined();
    expect(Cookies.get()).toEqual({
      theme: "dark",
      spaced: "a b",
      quoted: "hello world",
    });
  });

  it("writes encoded cookies with attributes", () => {
    stubBrowser();

    const written = Cookies.set("hello world", "a/b", {
      expires: new Date("2024-01-02T00:00:00.000Z"),
      path: "/admin",
      domain: "example.com",
      secure: true,
      sameSite: "lax",
      partitioned: true,
    });

    expect(written).toBe(
      "hello%20world=a%2Fb; expires=Tue, 02 Jan 2024 00:00:00 GMT; path=/admin; domain=example.com; secure; samesite=lax; partitioned",
    );
    expect(globalThis.document?.cookie).toBe(written);
  });

  it("removes cookies by writing an expired value", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-02T00:00:00.000Z"));
    stubBrowser("theme=dark");

    Cookies.remove("theme", { path: "/admin" });

    expect(globalThis.document?.cookie).toBe(
      "theme=; expires=Mon, 01 Jan 2024 00:00:00 GMT; path=/admin",
    );
  });

  it("creates scoped cookie APIs with default attributes", () => {
    stubBrowser();
    const scoped = Cookies.withAttributes({
      path: "/admin",
      sameSite: "strict",
    });

    expect(scoped.attributes).toEqual({ path: "/admin", sameSite: "strict" });
    expect(scoped.set("theme", "dark", { secure: true })).toBe(
      "theme=dark; path=/admin; secure; samesite=strict",
    );
  });

  it("creates custom converter cookie APIs", () => {
    stubBrowser();
    const customCookies = createCookies(
      {
        write: (value: number) => `n:${value}`,
        read: (value: string) => Number(value.slice(2)),
      },
      { path: "/numbers" },
    );

    customCookies.set("answer", 42);

    expect(globalThis.document?.cookie).toBe("answer=n:42; path=/numbers");
    expect(customCookies.get("answer")).toBe(42);
    expect(customCookies.converter.read("n:7")).toBe(7);
  });

  it("supports converter replacement and the JSON converter", () => {
    stubBrowser();
    const jsonCookies = Cookies.withConverter(jsonConverter);

    const written = jsonCookies.set("profile", { name: "Ada" });

    expect(written).toBe("profile=%7B%22name%22%3A%22Ada%22%7D; path=/");
    expect(jsonCookies.get("profile")).toEqual({ name: "Ada" });
    expect(jsonConverter.read("%7B%22enabled%22%3Atrue%7D")).toEqual({
      enabled: true,
    });
    expect(jsonConverter.read("not-json")).toBe("not-json");
  });

  it("checks, lists, clears, and serializes JSON cookies", () => {
    stubBrowser("a=1; b=2");
    const removeSpy = vi.spyOn(Cookies, "remove");

    expect(hasCookie("a")).toBe(true);
    expect(hasCookie("missing")).toBe(false);
    expect(getCookieNames()).toEqual(["a", "b"]);

    clearAllCookies({ path: "/" });
    expect(removeSpy).toHaveBeenCalledWith("a", { path: "/" });
    expect(removeSpy).toHaveBeenCalledWith("b", { path: "/" });

    setCookieJSON("settings", { density: "compact" });
    expect(getCookieJSON("settings")).toEqual({ density: "compact" });
    expect(getCookieJSON("missing")).toBeUndefined();
  });
});
