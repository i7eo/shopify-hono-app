import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpClient, HttpClient } from "../src/client";
import { HttpRequestError } from "../src/errors";
import type { HttpPlugin } from "../src";

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function requestAt(fetchMock: FetchMock, index = 0): Request {
  const [input, init] = fetchMock.mock.calls[index] as Parameters<typeof fetch>;
  return input instanceof Request ? input : new Request(input, init);
}

describe("HttpClient core", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("creates a fetch client and exposes ky for escape-hatch usage", () => {
    const client = createHttpClient();

    expect(client).toBeInstanceOf(HttpClient);
    expect(client.ky).toBeTypeOf("function");
  });

  it("serializes query params and optional cache-busting timestamps", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_704_164_645_000);
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(json({ ok: true })),
    );
    const client = createHttpClient({ fetch: fetchMock });

    await expect(
      client.get("https://example.com/users", {
        query: { page: 1, role: ["admin", "editor"] },
        timestamp: true,
      }),
    ).resolves.toEqual({ ok: true });

    const url = new URL(requestAt(fetchMock).url);
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.getAll("role[]")).toEqual(["admin", "editor"]);
    expect(url.searchParams.get("_t")).toBe("1704164645000");
  });

  it("ignores prefix and baseUrl when input is an absolute URL", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(json({ ok: true })),
    );
    const client = createHttpClient({
      baseUrl: "https://app.example.com",
      fetch: fetchMock,
      prefix: "/api",
    });

    await client.get("https://example.com/users");
    await client.get(new URL("https://example.com/from-url"));
    await client.get(new Request("https://example.com/from-request"));

    expect(requestAt(fetchMock, 0).url).toBe("https://example.com/users");
    expect(requestAt(fetchMock, 1).url).toBe("https://example.com/from-url");
    expect(requestAt(fetchMock, 2).url).toBe(
      "https://example.com/from-request",
    );
  });

  it("keeps prefix behavior for later relative input", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(json({ ok: true })),
    );
    const client = createHttpClient({
      baseUrl: "https://app.example.com",
      fetch: fetchMock,
      prefix: "/api",
    });

    await client.get("https://example.com/users");
    await client.get("users");

    expect(requestAt(fetchMock, 0).url).toBe("https://example.com/users");
    expect(requestAt(fetchMock, 1).url).toBe(
      "https://app.example.com/api/users",
    );
  });

  it("keeps request bodies untouched unless an explicit plugin changes them", async () => {
    const bodies: string[] = [];
    const source = {
      name: " Ada ",
      date: new Date(2024, 0, 2, 3, 4, 5),
    };
    const fetchMock = vi.fn<typeof fetch>(async () => {
      bodies.push(await requestAt(fetchMock, bodies.length).clone().text());
      return json({ ok: true });
    });
    const client = createHttpClient({ fetch: fetchMock });

    await client.post("https://example.com/users", source);
    await client.put("https://example.com/users/1", source);
    await client.patch("https://example.com/users/1", source);
    await client.delete("https://example.com/users/1");

    expect(JSON.parse(bodies[0]!)).toEqual({
      name: " Ada ",
      date: "2024-01-01T19:04:05.000Z",
    });
    expect(source.name).toBe(" Ada ");
    expect(requestAt(fetchMock, 1).method).toBe("PUT");
    expect(requestAt(fetchMock, 2).method).toBe("PATCH");
    expect(requestAt(fetchMock, 3).method).toBe("DELETE");
  });

  it("supports urlencoded bodies, raw responses, text responses, and uploads", async () => {
    const bodies: string[] = [];
    const uploadFields: Array<[string, FormDataEntryValue[]]> = [];
    // @ts-ignore
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      // @ts-ignore
      const index = fetchMock.mock.calls.length - 1;

      if (index === 2) {
        const formData = await request.clone().formData();
        uploadFields.push(
          ["tag", formData.getAll("tag")],
          ["labels[]", formData.getAll("labels[]")],
        );
        return json({ uploaded: true });
      }

      bodies.push(await request.clone().text());
      return index === 1 ? new Response("hello") : json({ ok: true });
    });
    const client = createHttpClient({ fetch: fetchMock });

    await client.post(
      "https://example.com/form",
      { a: 1 },
      { headers: { "content-type": "application/x-www-form-urlencoded" } },
    );
    await expect(
      client.request("https://example.com/text", { responseType: "text" }),
    ).resolves.toBe("hello");
    await client.upload("https://example.com/upload", {
      file: new Blob(["file"]),
      filename: "file.txt",
      data: { tag: "avatar", labels: ["a", "b"] },
    });

    expect(bodies[0]).toBe("a=1");
    expect(requestAt(fetchMock, 2).headers.get("content-type")).toContain(
      "multipart/form-data; boundary=",
    );
    expect(uploadFields).toEqual([
      ["tag", ["avatar"]],
      ["labels[]", ["a", "b"]],
    ]);
  });

  it("validates request and response schemas through the built-in validation plugin", async () => {
    const bodies: string[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      bodies.push(await request.clone().text());
      return json({ id: "1" });
    });
    const client = createHttpClient({ fetch: fetchMock });

    await expect(
      client.post(
        "https://example.com/items",
        { id: "1" },
        {
          bodySchema: (value) => ({
            ...(value as Record<string, unknown>),
            id: 1,
          }),
          responseSchema: (value) => ({
            ...(value as Record<string, unknown>),
            ok: true,
          }),
        },
      ),
    ).resolves.toEqual({ id: "1", ok: true });
    expect(JSON.parse(bodies[0]!)).toEqual({ id: 1 });
  });

  it("runs hooks and plugins in a deterministic request lifecycle", async () => {
    const events: string[] = [];
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ ok: true }))
      .mockRejectedValueOnce(new Error("Network down"));
    const plugin: HttpPlugin = {
      beforeRequest: (config) => {
        events.push("plugin:beforeRequest");
        return config;
      },
      afterResponse: (response) => {
        events.push("plugin:afterResponse");
        return response;
      },
      beforeError: (error) => {
        events.push(`plugin:beforeError:${error.message}`);
        return error;
      },
    };
    const client = createHttpClient({
      fetch: fetchMock,
      plugins: [plugin],
      hooks: {
        beforeRequest: (config) => {
          events.push("hook:beforeRequest");
          return config;
        },
        afterResponse: (response) => {
          events.push("hook:afterResponse");
          return response;
        },
        beforeError: (error) => {
          events.push(`hook:beforeError:${error.message}`);
          return new Error(`wrapped:${error.message}`);
        },
      },
    });

    await expect(client.get("https://example.com/ok")).resolves.toEqual({
      ok: true,
    });
    await expect(client.get("https://example.com/fail")).rejects.toThrow(
      "wrapped:Network down",
    );
    expect(events).toEqual([
      "hook:beforeRequest",
      "plugin:beforeRequest",
      "plugin:afterResponse",
      "hook:afterResponse",
      "hook:beforeRequest",
      "plugin:beforeRequest",
      "plugin:beforeError:Network down",
      "hook:beforeError:Network down",
    ]);
  });

  it("aborts and clears pending dedupe requests when disposed", async () => {
    let capturedSignal: AbortSignal | undefined;
    let start!: () => void;
    const started = new Promise<void>((resolve) => {
      start = resolve;
    });
    const fetchMock = vi.fn<typeof fetch>(
      async (input, init) =>
        await new Promise<Response>((_, reject) => {
          const request =
            input instanceof Request ? input : new Request(input, init);
          capturedSignal = request.signal;
          start();
          request.signal.addEventListener("abort", () => {
            reject(request.signal.reason);
          });
        }),
    );
    const client = createHttpClient({ fetch: fetchMock });

    const pending = client.get("https://example.com/slow", { dedupe: true });
    await started;
    client.dispose();

    await expect(pending).rejects.toMatchObject({ kind: "abort" });
    expect(capturedSignal?.aborted).toBe(true);
    await expect(
      client.get("https://example.com/after-dispose"),
    ).rejects.toBeInstanceOf(HttpRequestError);
  });
});
