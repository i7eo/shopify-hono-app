/**
 * Error type used by scripts to prefix failures with a scope.
 */
class RepositoryScriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryScriptError";
  }
}

/**
 * Throw a scoped script error and stop execution.
 */
export function throwError(scope: string, message: string): never {
  throw new RepositoryScriptError(`[${scope}] ${message}`);
}

/**
 * Check whether a value is a non-null object.
 */
export function isObject(
  value: unknown,
): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === "object";
}

/**
 * Serialize a value with JSON.stringify.
 */
export function serializeValue<T>(value: T): string {
  return JSON.stringify(value);
}
