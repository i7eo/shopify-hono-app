/**
 * Error type used by utility helpers to prefix failures with a scope.
 */
class ShamtError extends Error {
  constructor(m: string) {
    super(m);
    this.name = "ShamtError";
  }
}

/**
 * Throw a scoped utility error and stop execution.
 */
export function throwError(scope: string, m: string): never {
  throw new ShamtError(`[${scope}] ${m}`);
}
