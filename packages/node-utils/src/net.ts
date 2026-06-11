import os from "node:os";

/**
 * Return non-internal IPv4 addresses for the current machine plus the IPv6 any host.
 *
 * @example
 * ```ts
 * const hosts = getLocalhostAddress();
 * console.log(hosts);
 * ```
 */
export function getLocalhostAddress(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  const seen = new Set<string>();

  for (const group of Object.values(interfaces)) {
    if (!group) continue;

    for (const iface of group) {
      const family = String(iface.family);
      const isIPv4 = family === "IPv4" || family === "4";

      if (!isIPv4 || iface.internal || seen.has(iface.address)) continue;

      seen.add(iface.address);
      addresses.push(iface.address);
    }
  }

  addresses.push("[::]");
  return addresses;
}
