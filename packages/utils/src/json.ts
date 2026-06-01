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

export function serializeValue<T>(value: T): string {
  return JSON.stringify(value);
}

export function deserializeValue<T = unknown>(
  value: string | null,
): T | undefined {
  return safeJsonParse<T>(value ?? undefined);
}
