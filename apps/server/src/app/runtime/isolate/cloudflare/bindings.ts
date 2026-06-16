/**
 * Enforces request-bound Cloudflare bindings at the capability boundary.
 * Bootstrap config may be parsed from process.env before bindings exist, so
 * bindings stay optional in schema and become required where they are used.
 */
export function requireCloudflareBinding<T>(
  value: unknown,
  name: string,
  isValid?: (value: unknown) => value is T,
): T {
  if (value === undefined || (isValid && !isValid(value))) {
    throw new Error(`Cloudflare binding is invalid or missing: ${name}`);
  }

  return value as T;
}

/**
 * Runtime shape check for the KV namespace methods used by Shopify session
 * storage and other Cloudflare-specific capabilities.
 */
export function isCloudflareKVNamespace(value: unknown): value is KVNamespace {
  if (!value || typeof value !== "object") return false;

  const namespace = value as Partial<KVNamespace>;
  return (
    typeof namespace.get === "function" &&
    typeof namespace.put === "function" &&
    typeof namespace.delete === "function" &&
    typeof namespace.list === "function"
  );
}
