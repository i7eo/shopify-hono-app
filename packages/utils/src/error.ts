class UnimoleculeError extends Error {
  constructor(m: string) {
    super(m);
    this.name = "UnimoleculeError";
  }
}

export function throwError(scope: string, m: string): never {
  throw new UnimoleculeError(`[${scope}] ${m}`);
}
