/**
 * Resolve after the given number of milliseconds.
 */
export function sleep(ms: number = 16.7) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
