import { getPackagesSync } from "@unimolecule/utils/node";

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
 * Find the nearest monorepo root using @manypkg workspace discovery.
 */
export function findMonorepoRoot(cwd: string = process.cwd()): string {
  try {
    return getPackagesSync(cwd).rootDir;
  } catch {
    return "";
  }
}

export { isObject, serializeValue } from "@unimolecule/utils";
