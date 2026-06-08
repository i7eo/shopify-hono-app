import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpClient, HttpClient } from "../src/client";
import { HttpRequestError } from "../src/errors";

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

function createJsonResponse(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function readRequest(fetchMock: FetchMock, index = 0): Request {
  const [input, init] = fetchMock.mock.calls[index] as Parameters<typeof fetch>;
  return input instanceof Request ? input : new Request(input, init);
}

describe("HttpClient", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("creates clients and exposes the underlying ky instance", () => {
    const client = createHttpClient();

    expect(client).toBeInstanceOf(HttpClient);
    expect(client.ky).toBeTypeOf("function");
  });

  it("sends GET requests with query params and timestamp behavior", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_704_164_645_000);
    const fetchMock = vi.fn<typeof fetch>(
      async () => await createJsonResponse({ ok: true }),
    );
    const client = createHttpClient({ fetch: fetchMock });

    await expect(
      client.get("https://example.com/users", {
        query: { page: 1 },
        timestamp: true,
      }),
    ).resolves.toEqual({ ok: true });

    const request = readRequest(fetchMock);
    expect(request.method).toBe("GET");
    expect(new URL(request.url).searchParams.get("page")).toBe("1");
    expect(new URL(request.url).searchParams.get("_t")).toBe("1704164645000");
  });

  it("sends body methods and normalizes JSON request data", async () => {
    const requestBodies: string[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      requestBodies.push(await request.clone().text());
      return createJsonResponse({ ok: true });
    });
    const client = createHttpClient({ fetch: fetchMock });

    await client.post("https://example.com/items", {
      name: " Ada ",
      date: new Date(2024, 0, 2, 3, 4, 5),
    });
    await client.put("https://example.com/items/1", { name: " Put " });
    await client.patch("https://example.com/items/1", { name: " Patch " });
    await client.delete("https://example.com/items/1");

    const post = readRequest(fetchMock, 0);
    expect(post.method).toBe("POST");
    expect(JSON.parse(requestBodies[0])).toEqual({
      name: "Ada",
      date: "2024-01-02 03:04:05",
    });
    expect(readRequest(fetchMock, 1).method).toBe("PUT");
    expect(readRequest(fetchMock, 2).method).toBe("PATCH");
    expect(readRequest(fetchMock, 3).method).toBe("DELETE");
  });

  it("supports urlencoded body, raw responses, text responses, and uploads", async () => {
    const requestBodies: string[] = [];
    const uploadFields: Array<[string, FormDataEntryValue[]]> = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      const callIndex = requestBodies.length;

      if (callIndex === 2) {
        const formData = await request.clone().formData();
        uploadFields.push(
          ["tag", formData.getAll("tag")],
          ["labels[]", formData.getAll("labels[]")],
        );
      } else {
        requestBodies.push(await request.clone().text());
      }

      if (callIndex === 1) {
        return new Response("hello");
      }
      return createJsonResponse(
        callIndex === 2 ? { uploaded: true } : { ok: true },
      );
    });
    const client = createHttpClient({ fetch: fetchMock });

    await client.post(
      "https://example.com/form",
      { a: 1 },
      {
        headers: { "content-type": "application/x-www-form-urlencoded" },
      },
    );
    await expect(
      client.request("https://example.com/text", { responseType: "text" }),
    ).resolves.toBe("hello");
    await client.upload("https://example.com/upload", {
      file: new Blob(["file"]),
      filename: "file.txt",
      data: { tag: "avatar", labels: ["a", "b"] },
    });

    expect(requestBodies[0]).toBe("a=1");
    expect(readRequest(fetchMock, 2).headers.get("content-type")).toContain(
      "multipart/form-data; boundary=",
    );
    expect(uploadFields).toEqual([
      ["tag", ["avatar"]],
      ["labels[]", ["a", "b"]],
    ]);
  });

  it("validates request and response schemas", async () => {
    const requestBodies: string[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      requestBodies.push(await request.clone().text());
      return createJsonResponse({ id: "1" });
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

    expect(JSON.parse(requestBodies[0])).toEqual({ id: 1 });
  });

  it("returns parsed response objects when responseType is response", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => await createJsonResponse({ ok: true }),
    );
    const client = createHttpClient({ fetch: fetchMock });

    const response = await client.get<Response>("https://example.com/raw", {
      responseType: "response",
    });

    expect(response).toBeInstanceOf(Response);
  });

  it("supports high-level hooks, extension, and error message handlers", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(createJsonResponse({ ok: true }))
      .mockRejectedValueOnce(new Error("Network down"));
    const onErrorMessage = vi.fn();
    const afterResponse = vi.fn((response) => response);
    const client = createHttpClient({
      fetch: fetchMock,
      headers: { "x-base": "base" },
      defaults: { onErrorMessage },
      hooks: {
        beforeRequest: (config) => ({
          ...config,
          headers: {
            ...Object.fromEntries(new Headers(config.headers as HeadersInit)),
            "x-hook": "hook",
          },
        }),
        afterResponse,
        beforeError: (error) => new Error(`wrapped: ${error.message}`),
      },
    }).extend({
      headers: { "x-extended": "extended" },
      defaults: { timestamp: false },
    });

    await expect(client.get("https://example.com/hook")).resolves.toEqual({
      ok: true,
    });
    expect(readRequest(fetchMock).headers.get("x-hook")).toBe("hook");
    expect(afterResponse).toHaveBeenCalledOnce();

    await expect(client.get("https://example.com/error")).rejects.toThrow(
      "wrapped: Network down",
    );
    expect(onErrorMessage).toHaveBeenCalledWith(
      "Network down",
      expect.objectContaining({ error: expect.any(HttpRequestError) }),
    );
  });

  it("throws for business failures and invalid JSON", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createJsonResponse({ success: false, message: "Nope" }),
      )
      .mockResolvedValueOnce(new Response("not-json"));
    const client = createHttpClient({ fetch: fetchMock });

    await expect(
      client.get("https://example.com/business"),
    ).rejects.toMatchObject({
      kind: "business",
      message: "Nope",
    });
    await expect(
      client.get("https://example.com/invalid"),
    ).rejects.toMatchObject({
      kind: "unknown",
      message: "Invalid JSON response",
    });
  });
});
