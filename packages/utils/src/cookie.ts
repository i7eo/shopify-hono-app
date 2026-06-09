import { isClient } from "./is";
import { deserializeValue, serializeValue } from "./json";

/**
 * Engineering-grade cookie operation library.
 *
 * @example
 * Cookies.set("theme", "dark", { sameSite: "lax" });
 * const theme = Cookies.get("theme");
 * Cookies.remove("theme");
 */

type CookieDocument = {
  cookie: string;
};

/**
 * Cookie attribute options
 */
export interface CookieAttributes {
  /**
   * A number will be interpreted as days from time of creation.
   * A Date instance will be converted to UTC string.
   * If omitted, the cookie becomes a session cookie.
   */
  expires?: number | Date;

  /**
   * Cookie path. Defaults to '/'.
   */
  path?: string;

  /**
   * Cookie domain. Defaults to the host portion of the current document location.
   */
  domain?: string;

  /**
   * If true, the cookie will only be transmitted over secure protocol as HTTPS.
   */
  secure?: boolean;

  /**
   * SameSite attribute. Controls whether the cookie is sent with cross-site requests.
   * - 'strict': Cookie is only sent for same-site requests
   * - 'lax': Cookie is sent for same-site requests and top-level navigation
   * - 'none': Cookie is sent for all requests (requires secure=true)
   */
  sameSite?: "strict" | "lax" | "none";

  /**
   * Prevents client-side JavaScript from accessing the cookie.
   * Note: This can only be set by the server, not by client-side JavaScript.
   * Included for type completeness when parsing cookies.
   */
  httpOnly?: boolean;

  /**
   * Partitioned attribute for cookies in partitioned storage (CHIPS).
   */
  partitioned?: boolean;
}

/**
 * Converter interface for custom encoding/decoding of cookie values
 */
export interface CookieConverter<T = string> {
  /**
   * Encode value before writing to cookie
   */
  write: (value: T) => string;

  /**
   * Decode value after reading from cookie
   */
  read: (value: string) => T;
}

/**
 * Cookie API interface
 */
export interface CookieApi<T = string> {
  /**
   * Get a cookie by name
   */
  get: ((name: string) => T | undefined) & (() => Record<string, T>);

  /**
   * Set a cookie
   */
  set: (name: string, value: T, attributes?: CookieAttributes) => string;

  /**
   * Remove a cookie
   */
  remove: (name: string, attributes?: CookieAttributes) => void;

  /**
   * Create a new instance with custom default attributes
   */
  withAttributes: (attributes: CookieAttributes) => CookieApi<T>;

  /**
   * Create a new instance with a custom converter
   */
  withConverter: <U>(converter: CookieConverter<U>) => CookieApi<U>;

  /**
   * Current default attributes
   */
  readonly attributes: CookieAttributes;

  /**
   * Current converter
   */
  readonly converter: CookieConverter<T>;
}

/**
 * Default cookie attributes
 */
const DEFAULT_ATTRIBUTES: CookieAttributes = {
  path: "/",
};

/**
 * Default converter for string values
 */
const DEFAULT_CONVERTER: CookieConverter<string> = {
  write: (value: string): string => {
    return encodeURIComponent(value);
  },
  read: (value: string): string => {
    // Handle quoted values (RFC 6265)
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    return decodeURIComponent(value.replaceAll("+", " "));
  },
};

/**
 * JSON converter for object values
 *
 * @example
 * const JsonCookies = Cookies.withConverter(jsonConverter);
 * JsonCookies.set("profile", { name: "Ada" });
 * const profile = JsonCookies.get("profile");
 */
export const jsonConverter: CookieConverter<unknown> = {
  write: (value: unknown): string => {
    return encodeURIComponent(String(serializeValue(value)));
  },
  read: (value: string): unknown => {
    // Handle quoted values (RFC 6265)
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    const decodedValue = decodeURIComponent(value.replaceAll("+", " "));
    const parsedValue = deserializeValue(decodedValue);
    return parsedValue === undefined ? value : parsedValue;
  },
};

/**
 * Check if we're in a browser environment
 */
function getCookieDocument(): CookieDocument | undefined {
  const scope = globalThis as typeof globalThis & {
    document?: CookieDocument;
  };

  return typeof scope.document?.cookie === "string"
    ? scope.document
    : undefined;
}

/**
 * Encode cookie name according to RFC 6265
 */
const encodeName = (name: string): string => {
  return encodeURIComponent(name)
    .replaceAll(
      /[()]/g,
      (char) => `%${char.codePointAt(0)?.toString(16).toUpperCase()}`,
    )
    .replaceAll(/%(2[346BF]|3[AC-F]|40|5[BDE]|60|7[BCD])/g, decodeURIComponent);
};

/**
 * Build cookie string from attributes
 */
const buildAttributeString = (attributes: CookieAttributes): string => {
  const parts: string[] = [];

  if (attributes.expires !== undefined) {
    let expires: Date;
    if (typeof attributes.expires === "number") {
      expires = new Date(Date.now() + attributes.expires * 864e5); // 86400000ms = 1 day
    } else {
      expires = attributes.expires;
    }
    parts.push(`expires=${expires.toUTCString()}`);
  }

  if (attributes.path !== undefined) {
    parts.push(`path=${attributes.path}`);
  }

  if (attributes.domain !== undefined) {
    parts.push(`domain=${attributes.domain}`);
  }

  if (attributes.secure) {
    parts.push("secure");
  }

  if (attributes.sameSite !== undefined) {
    parts.push(`samesite=${attributes.sameSite}`);
  }

  if (attributes.partitioned) {
    parts.push("partitioned");
  }

  return parts.join("; ");
};

/**
 * Parse document.cookie string into key-value pairs
 */
const parseCookies = (): Record<string, string> => {
  if (!isClient()) {
    return {};
  }

  const cookies: Record<string, string> = {};

  const document = getCookieDocument();
  if (!document) return cookies;
  const cookieString = document.cookie;

  if (!cookieString) {
    return cookies;
  }

  const pairs = cookieString.split("; ");

  for (const pair of pairs) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) continue;

    const name = pair.slice(0, separatorIndex);
    const value = pair.slice(separatorIndex + 1);

    try {
      const decodedName = decodeURIComponent(name);
      // Don't override if we already have this cookie (first occurrence wins)
      if (cookies[decodedName] === undefined) {
        cookies[decodedName] = value;
      }
    } catch {
      // Ignore malformed cookie names
    }
  }

  return cookies;
};

/**
 * Create a cookie API instance
 */
function createCookieApi<T = string>(
  converter: CookieConverter<T> = DEFAULT_CONVERTER as unknown as CookieConverter<T>,
  defaultAttributes: CookieAttributes = DEFAULT_ATTRIBUTES,
): CookieApi<T> {
  function get(name: string): T | undefined;
  function get(): Record<string, T>;
  function get(name?: string): T | undefined | Record<string, T> {
    const cookies = parseCookies();

    if (name === undefined) {
      // Return all cookies
      const result: Record<string, T> = {};
      for (const [key, value] of Object.entries(cookies)) {
        try {
          result[key] = converter.read(value);
        } catch {
          // Ignore cookies that can't be decoded
        }
      }
      return result;
    }

    // Return specific cookie
    const value = cookies[name];
    if (value === undefined) {
      return undefined;
    }

    try {
      return converter.read(value);
    } catch {
      return undefined;
    }
  }

  function set(name: string, value: T, attributes?: CookieAttributes): string {
    if (!isClient()) {
      return "";
    }

    const mergedAttributes = { ...defaultAttributes, ...attributes };
    const encodedName = encodeName(name);
    const encodedValue = converter.write(value);
    const attributeString = buildAttributeString(mergedAttributes);

    const cookieString = attributeString
      ? `${encodedName}=${encodedValue}; ${attributeString}`
      : `${encodedName}=${encodedValue}`;

    const document = getCookieDocument();
    if (!document) return "";
    document.cookie = cookieString;
    return cookieString;
  }

  function remove(name: string, attributes?: CookieAttributes): void {
    // Remove by setting expiration to the past
    set(name, "" as unknown as T, {
      ...attributes,
      expires: -1,
    });
  }

  function withAttributes(attributes: CookieAttributes): CookieApi<T> {
    return createCookieApi<T>(converter, {
      ...defaultAttributes,
      ...attributes,
    });
  }

  function withConverter<U>(newConverter: CookieConverter<U>): CookieApi<U> {
    return createCookieApi<U>(newConverter, defaultAttributes);
  }

  return {
    get,
    set,
    remove,
    withAttributes,
    withConverter,
    get attributes() {
      return { ...defaultAttributes };
    },
    get converter() {
      return converter;
    },
  };
}

/**
 * Default cookie instance with string values
 *
 * @example
 * Cookies.set("locale", "en-US");
 * const locale = Cookies.get("locale");
 */
export const Cookies = createCookieApi<string>();

/**
 * Create a custom cookie instance
 *
 * @example
 * const ScopedCookies = createCookies(undefined, { path: "/admin" });
 * ScopedCookies.set("sidebar", "collapsed");
 */
export const createCookies = createCookieApi;

/**
 * Utility functions for common cookie operations
 */

/**
 * Check if a cookie exists
 *
 * @example
 * if (hasCookie("session")) {
 *   // Continue with an authenticated browser flow.
 * }
 */
export function hasCookie(name: string): boolean {
  return Cookies.get(name) !== undefined;
}

/**
 * Get all cookie names
 *
 * @example
 * const names = getCookieNames();
 */
export function getCookieNames(): string[] {
  return Object.keys(Cookies.get());
}

/**
 * Clear all cookies (for the current path and domain)
 *
 * @example
 * clearAllCookies({ path: "/" });
 */
export function clearAllCookies(attributes?: CookieAttributes): void {
  const names = getCookieNames();
  for (const name of names) {
    Cookies.remove(name, attributes);
  }
}

/**
 * Get cookie as JSON (convenience function)
 *
 * @example
 * const settings = getCookieJSON<{ density: "compact" | "comfortable" }>("settings");
 */
export function getCookieJSON<T = unknown>(name: string): T | undefined {
  const value = Cookies.get(name);
  if (value === undefined) {
    return undefined;
  }
  return deserializeValue<T>(value);
}

/**
 * Set cookie as JSON (convenience function)
 *
 * @example
 * setCookieJSON("settings", { density: "compact" }, { sameSite: "lax" });
 */
export function setCookieJSON<T>(
  name: string,
  value: T,
  attributes?: CookieAttributes,
): string {
  return Cookies.set(name, serializeValue(value), attributes);
}
