/**
 * Enforces request-bound Cloudflare bindings at the capability boundary.
 * Bootstrap config may be parsed from process.env before bindings exist, so
 * bindings stay optional in schema and become required where they are used.
 *
 * Example: databaseFactory requires D1 or Hyperdrive only after the request
 * context is available.
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
 * Runtime shape check for the D1 database binding used by Cloudflare database
 * capabilities.
 */
export function isCloudflareD1Database(value: unknown): value is D1Database {
  if (!value || typeof value !== "object") return false;

  const database = value as Partial<D1Database>;
  return (
    typeof database.prepare === "function" &&
    typeof database.batch === "function" &&
    typeof database.exec === "function"
  );
}

/**
 * Runtime shape check for the Hyperdrive binding used by Cloudflare Postgres
 * capabilities.
 */
export function isCloudflareHyperdrive(value: unknown): value is Hyperdrive {
  if (!value || typeof value !== "object") return false;

  const hyperdrive = value as Partial<Hyperdrive>;
  return typeof hyperdrive.connectionString === "string";
}
