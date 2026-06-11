/**
 * Convert Windows path separators to forward slashes.
 *
 * @example
 * ```ts
 * const normalized = formatPath(String.raw`C:\Users\i7eo\app`);
 * ```
 */
export function formatPath(p: string) {
  return p.includes("\\") ? p.replaceAll("\\", "/") : p;
}
