import { createHttpClient } from "@shamt/oh-my-fetch/client";
import { HttpRequestError } from "@shamt/oh-my-fetch/errors";
import { businessStatusPlugin } from "@shamt/oh-my-fetch/plugins/business-status";
import { errorReporterPlugin } from "@shamt/oh-my-fetch/plugins/error-reporter";
import { requestFormatPlugin } from "@shamt/oh-my-fetch/plugins/request-format";
import { describe, expect, it, vi } from "vitest";

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("plugins", () => {
  it("normalizes request data only when requestFormatPlugin is installed", async () => {
    const bodies: string[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      bodies.push(await request.clone().text());
      return json({ ok: true });
    });
    const client = createHttpClient({
      fetch: fetchMock,
      plugins: [requestFormatPlugin()],
    });

    await client.post("https://example.com/users", {
      name: " Ada ",
      date: new Date(2024, 0, 2, 3, 4, 5),
      nested: [" value "],
    });

    expect(JSON.parse(bodies[0]!)).toEqual({
      name: "Ada",
      date: "2024-01-02 03:04:05",
      nested: ["value"],
    });
  });

  it("turns default business wrappers into HttpRequestError when businessStatusPlugin is installed", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(json({ success: false, message: "Nope" })),
    );
    const client = createHttpClient({
      fetch: fetchMock,
      plugins: [businessStatusPlugin()],
    });

    await expect(
      client.get("https://example.com/default"),
    ).rejects.toMatchObject({
      kind: "business",
      message: "Nope",
    });
  });

  it("supports custom business status validators", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(json({ ok: false, code: "CUSTOM" })),
    );
    const client = createHttpClient({
      fetch: fetchMock,
      plugins: [
        businessStatusPlugin({
          validator: (data) => {
            const result = data as { ok?: boolean; code?: string };
            if (result.ok === false) {
              return {
                failed: true,
                code: result.code,
                status: 409,
                message: "Custom failure",
                data,
              };
            }
            return false;
          },
        }),
      ],
    });

    await expect(
      client.get("https://example.com/custom"),
    ).rejects.toMatchObject({
      kind: "business",
      code: "CUSTOM",
      status: 409,
      message: "Custom failure",
    });
  });

  it("reports normalized errors through errorReporterPlugin without replacing them", async () => {
    const reporter = { report: vi.fn() };
    const fetchMock = vi.fn<typeof fetch>(() => {
      throw new Error("Network down");
    });
    const client = createHttpClient({
      fetch: fetchMock,
      plugins: [errorReporterPlugin(reporter)],
    });

    await expect(client.get("https://example.com/fail")).rejects.toMatchObject({
      kind: "unknown",
      message: "Network down",
    });
    expect(reporter.report).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "unknown", message: "Network down" }),
      expect.objectContaining({ error: expect.any(HttpRequestError) }),
    );
  });
});
