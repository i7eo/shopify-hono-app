class ShamtError extends Error {
  constructor(m: string) {
    super(m);
    this.name = "ShamtError";
  }
}

export function throwError(scope: string, m: string): never {
  throw new ShamtError(`[${scope}] ${m}`);
}
