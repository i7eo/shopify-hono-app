import { RESPONSE_ERROR_MESSAGE } from "@shamt/envs";
import { describe, expect, it } from "vitest";
import { resolveStatusMessage } from "../src/status";
import {
  STATUS_MESSAGE_BY_CODE,
  STATUS_MESSAGES,
} from "../src/status/constants";

describe("status utilities", () => {
  it("exports status message maps", () => {
    expect(STATUS_MESSAGES.NOT_FOUND).toBe("Not Found");
    expect(STATUS_MESSAGE_BY_CODE[404]).toBe("Not Found");
  });

  it("resolves explicit, known, unknown, and empty status messages", () => {
    expect(resolveStatusMessage(404, "From API")).toBe("From API");
    expect(resolveStatusMessage(404)).toBe("Not Found");
    expect(resolveStatusMessage(599)).toBe(RESPONSE_ERROR_MESSAGE);
    expect(resolveStatusMessage()).toBe(RESPONSE_ERROR_MESSAGE);
  });
});
