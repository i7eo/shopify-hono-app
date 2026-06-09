import dayjs from "dayjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  diffDays,
  formatToDate,
  formatToDateTime,
  isDateObject,
  previousDay,
} from "../src/date";
import { throwError } from "../src/error";
import { isTruthy, noNull, notNullish, notUndefined } from "../src/guards";
import { deserializeValue, safeJsonParse, serializeValue } from "../src/json";
import { generateRandom } from "../src/random";
import { sleep } from "../src/sleep";
import { ensurePrefix, ensureSuffix } from "../src/string";
import { timestamp } from "../src/time";

describe("date utilities", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats dates and date-times", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 2, 3, 4, 5));

    expect(formatToDateTime()).toBe("2024-01-02 03:04:05");
    expect(formatToDate("2024-03-04T10:11:12.000Z")).toBe("2024-03-04");
    expect(formatToDateTime("2024-03-04T10:11:12.000Z", "YYYY/MM/DD")).toBe(
      "2024/03/04",
    );
  });

  it("detects native Date and Day.js objects", () => {
    expect(isDateObject(new Date("2024-01-01T00:00:00.000Z"))).toBe(true);
    expect(isDateObject(dayjs("2024-01-01"))).toBe(true);
    expect(isDateObject("2024-01-01")).toBe(false);
  });

  it("calculates day differences and previous days", () => {
    expect(diffDays("2024-01-10", "2024-01-01")).toBe(9);
    expect(previousDay("2024-03-01")).toBe("2024-02-29");
  });
});

describe("error utilities", () => {
  it("throws scoped Shamt errors", () => {
    try {
      throwError("scope", "message");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).name).toBe("ShamtError");
      expect((error as Error).message).toBe("[scope] message");
    }
  });
});

describe("guard utilities", () => {
  it("filters nullish, null, undefined, and falsy values", () => {
    expect([1, null, 2, undefined].filter(notNullish)).toEqual([1, 2]);
    expect([1, null, 2].filter(noNull)).toEqual([1, 2]);
    expect([1, undefined, 2].filter(notUndefined)).toEqual([1, 2]);
    expect([1, 0, "value", "", false, true].filter(isTruthy)).toEqual([
      1,
      "value",
      true,
    ]);
  });
});

describe("JSON utilities", () => {
  it("safely parses JSON", () => {
    expect(safeJsonParse<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
    expect(safeJsonParse("not-json")).toBeUndefined();
    expect(safeJsonParse(null)).toBeUndefined();
  });

  it("serializes and deserializes values", () => {
    expect(serializeValue({ a: 1 })).toBe('{"a":1}');
    expect(deserializeValue<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
    expect(deserializeValue(null)).toBeUndefined();
  });
});

describe("random utilities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates floating point values by default", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.25);

    expect(generateRandom()).toEqual([0.25]);
  });

  it("generates integer values in a range", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    expect(
      generateRandom({ count: 3, min: 10, max: 20, integer: true }),
    ).toEqual([15, 15, 15]);
  });

  it("generates unique integer values", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.99);

    expect(
      generateRandom({ count: 3, min: 1, max: 4, integer: true, unique: true }),
    ).toEqual([1, 2, 3]);
  });

  it("throws on invalid ranges", () => {
    expect(() => generateRandom({ min: 2, max: 1 })).toThrow(
      "[generateRandom] 'min' cannot be greater than 'max'",
    );
    expect(() =>
      generateRandom({ count: 3, min: 1, max: 2, integer: true, unique: true }),
    ).toThrow("[generateRandom] The number of integers within the range");
  });
});

describe("sleep utilities", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after the requested delay", async () => {
    vi.useFakeTimers();
    let resolved = false;
    const promise = sleep(25).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(24);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(resolved).toBe(true);
  });
});

describe("string utilities", () => {
  it("ensures prefixes and suffixes exactly once", () => {
    expect(ensurePrefix("/", "admin")).toBe("/admin");
    expect(ensurePrefix("/", "/admin")).toBe("/admin");
    expect(ensureSuffix("/", "admin")).toBe("admin/");
    expect(ensureSuffix("/", "admin/")).toBe("admin/");
  });
});

describe("time utilities", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current timestamp in milliseconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-02T03:04:05.000Z"));

    expect(timestamp()).toBe(1_704_164_645_000);
  });
});
