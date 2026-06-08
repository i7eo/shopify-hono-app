import { describe, expect, it } from "vitest";
import { validateWithSchema } from "../src/validation";

describe("validateWithSchema", () => {
  it("validates with explicit adapters", async () => {
    await expect(
      validateWithSchema(
        {
          validateSchema: (value) => ({
            success: true,
            data: { wrapped: value },
          }),
        },
        "value",
        { target: "request", config: {} },
      ),
    ).resolves.toEqual({ wrapped: "value" });
  });

  it("validates with Standard Schema compatible schemas", async () => {
    await expect(
      validateWithSchema(
        {
          "~standard": {
            validate: () => ({
              issues: [{ path: ["name"], message: "Required" }],
            }),
          },
        },
        {},
        { target: "response", config: {}, response: new Response("{}") },
      ),
    ).rejects.toMatchObject({
      kind: "response_validation",
      code: 422,
      status: 422,
      message: "Unprocessable Entity: name Required",
    });
  });

  it("validates with safeParse and safeParseAsync schemas", async () => {
    await expect(
      validateWithSchema(
        { safeParse: () => ({ success: true, data: 1 }) },
        "1",
        { target: "request", config: {} },
      ),
    ).resolves.toBe(1);

    await expect(
      validateWithSchema(
        {
          safeParseAsync: () => ({
            success: false,
            error: { issues: [{ message: "Invalid" }] },
          }),
        },
        "bad",
        { target: "request", config: {} },
      ),
    ).rejects.toThrow("Unprocessable Entity: Invalid");
  });

  it("validates with function and Yup-like schemas", async () => {
    await expect(
      validateWithSchema((value) => String(value).trim(), " value ", {
        target: "request",
        config: {},
      }),
    ).resolves.toBe("value");

    await expect(
      validateWithSchema({ validate: (value) => ({ valid: value }) }, "value", {
        target: "response",
        config: {},
      }),
    ).resolves.toEqual({ valid: "value" });
  });

  it("normalizes thrown validation errors and unsupported schemas", async () => {
    await expect(
      validateWithSchema(
        {
          validate: () => {
            throw Object.assign(new Error("Yup failed"), {
              errors: ["name is required"],
            });
          },
        },
        {},
        { target: "request", config: {} },
      ),
    ).rejects.toThrow("Unprocessable Entity: Yup failed");

    await expect(
      validateWithSchema({} as never, {}, { target: "request", config: {} }),
    ).rejects.toThrow("Unprocessable Entity: Unsupported validation schema");
  });
});
