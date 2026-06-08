import { afterEach, describe, expect, it, vi } from "vitest";
import {
  is,
  isArray,
  isClient,
  isDef,
  isElement,
  isEmpty,
  isObject,
  isObjectLike,
  isServer,
  isUndef,
  isUrl,
  isWindow,
  objectToString,
} from "../src/is";

describe("is utilities", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("checks object toString type names", () => {
    expect(objectToString.call(new Map())).toBe("[object Map]");
    expect(is(new Date("2024-01-01T00:00:00.000Z"), "Date")).toBe(true);
    expect(is("value", "String")).toBe(true);
  });

  it("checks arrays, objects, and definitions", () => {
    expect(isArray([])).toBe(true);
    expect(isObject({})).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObjectLike({})).toBe(true);
    expect(isObjectLike([])).toBe(false);
    expect(isDef(0)).toBe(true);
    expect(isDef(undefined)).toBe(false);
    expect(isUndef(undefined)).toBe(true);
    expect(isUndef(null)).toBe(false);
  });

  it("checks empty values", () => {
    expect(isEmpty("")).toBe(true);
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty([])).toBe(true);
    expect(isEmpty({})).toBe(true);
    expect(isEmpty(0)).toBe(false);
    expect(isEmpty([1])).toBe(false);
    expect(isEmpty({ a: 1 })).toBe(false);
  });

  it("checks DOM-like globals", () => {
    class TestElement {}
    const win = {};

    vi.stubGlobal("Element", TestElement);
    vi.stubGlobal("window", win);

    expect(isElement(new TestElement() as never)).toBe(true);
    expect(isElement({ nodeType: 1, nodeName: "DIV" })).toBe(false);
    expect(isWindow(win)).toBe(true);
    expect(isWindow({})).toBe(false);
    expect(isServer()).toBe(false);
    expect(isClient()).toBe(true);
  });

  it("checks server runtime and absolute URLs", () => {
    expect(isServer()).toBe(true);
    expect(isClient()).toBe(false);
    expect(isUrl("https://example.com/admin?shop=test#top")).toBe(true);
    expect(isUrl("www.example.com/path")).toBe(true);
    expect(isUrl("/admin")).toBe(false);
  });
});
