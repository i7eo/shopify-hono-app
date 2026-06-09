import { parseJsonSafely, type applyJsonSecurity } from "../security/json";
import type { ParseJson } from "../client/types";
import type { HttpMethod, ResponseBodyType } from "../utils/types";

/**
 * Parse a Fetch response according to the requested response body type.
 *
 * @example
 * ```ts
 * const response = new Response(JSON.stringify({ ok: true }));
 * await parseResponseBody(response, "json", createJsonParser());
 * // { ok: true }
 * ```
 */
export async function parseResponseBody(
  response: Response,
  responseType: ResponseBodyType = "json",
  parseJson: ParseJson,
  method: HttpMethod = "GET",
): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  switch (responseType) {
    case "arrayBuffer":
      return response.arrayBuffer();
    case "blob":
      return response.blob();
    case "formData":
      return response.formData();
    case "text":
      return response.text();
    case "json": {
      const text = await response.text();
      return text
        ? parseJson(text, createJsonParseContext(response, method))
        : null;
    }

    default:
      return response;
  }
}

/**
 * Create a ky-compatible JSON parser with configurable security sanitization.
 *
 * @example
 * ```ts
 * const parseJson = createJsonParser("strict");
 * parseJson('{"safe":true}');
 * ```
 */
export function createJsonParser(
  security: Parameters<typeof applyJsonSecurity>[1] = "strict",
): ParseJson {
  return (text) => parseJsonSafely(text, security);
}

/**
 * Create the context object expected by ky parseJson callbacks.
 *
 * @example
 * ```ts
 * const context = createJsonParseContext(new Response("{}"), "GET");
 * context.request.method; // "GET"
 * ```
 */
function createJsonParseContext(
  response: Response,
  method: HttpMethod,
): Parameters<ParseJson>[1] {
  return {
    request: createSyntheticRequest(response, method),
    response,
  };
}

/**
 * Create a lightweight Request for custom JSON parsers that inspect method or URL.
 *
 * @example
 * ```ts
 * createSyntheticRequest(new Response("{}", { status: 200 }), "POST").method;
 * // "POST"
 * ```
 */
function createSyntheticRequest(
  response: Response,
  method: HttpMethod,
): Request {
  try {
    return new Request(response.url || "http://localhost/", { method });
  } catch {
    return new Request("http://localhost/", { method });
  }
}
