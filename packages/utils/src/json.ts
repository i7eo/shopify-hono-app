/**
 * Safely parse a JSON string and return undefined when parsing fails.
 */
export function safeJsonParse<T = unknown>(
  value: string | null | undefined,
): T | undefined {
  if (value == null) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

/**
 * Serialize a value with JSON.stringify.
 */
export function serializeValue<T>(value: T): string {
  return JSON.stringify(value);
}

/**
 * Deserialize a JSON string and return undefined for null or invalid input.
 */
export function deserializeValue<T = unknown>(
  value: string | null,
): T | undefined {
  return safeJsonParse<T>(value ?? undefined);
}
