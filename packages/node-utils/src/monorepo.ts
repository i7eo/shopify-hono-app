import {
  getPackages as getPackagesFunc,
  getPackagesSync as getPackagesSyncFunc,
  type Package,
} from "@manypkg/get-packages";

/**
 * Find the nearest monorepo root using @manypkg/get-packages root discovery.
 *
 * @example
 * ```ts
 * const root = findMonorepoRoot(process.cwd());
 * ```
 */
function findMonorepoRoot(cwd: string = process.cwd()) {
  try {
    return getPackagesSyncFunc(cwd).rootDir;
  } catch {
    return "";
  }
}

/**
 * Load all workspace packages synchronously from the nearest monorepo root.
 *
 * @example
 * ```ts
 * const { packages } = getPackagesSync(process.cwd());
 * ```
 */
function getPackagesSync(cwd: string = process.cwd()) {
  return getPackagesSyncFunc(cwd);
}

/**
 * Load all workspace packages from the nearest monorepo root.
 *
 * @example
 * ```ts
 * const { packages } = await getPackages(process.cwd());
 * ```
 */
async function getPackages(cwd: string = process.cwd()) {
  return await getPackagesFunc(cwd);
}

/**
 * Find a workspace package by its package.json name.
 *
 * @example
 * ```ts
 * const serverPackage = await getPackage("@shamt/server");
 * ```
 */
async function getPackage(pkgName: string, cwd: string = process.cwd()) {
  const { packages } = await getPackages(cwd);
  return packages.find((pkg: Package) => pkg.packageJson.name === pkgName);
}

export { findMonorepoRoot, getPackage, getPackages, getPackagesSync };
