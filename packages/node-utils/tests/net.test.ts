import { describe, expect, it } from "vitest";
import { getLocalhostAddress } from "../src/net";

describe("network helpers", () => {
  it("returns a stable string list that always includes the IPv6 any host", () => {
    const addresses = getLocalhostAddress();

    expect(addresses).toContain("[::]");
    expect(new Set(addresses).size).toBe(addresses.length);
    expect(addresses.every((address) => typeof address === "string")).toBe(
      true,
    );
  });
});
