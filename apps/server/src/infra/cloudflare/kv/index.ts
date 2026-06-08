import { deserializeValue, serializeValue } from "@shamt/utils";
import type { CloudflareKvCacheStore, StoredSession } from "@/types";

/**
 * KV-backed storage for Shopify sessions and OAuth state.
 *
 * Key patterns:
 *   offline:{shop}             -> StoredSession (permanent, from OAuth install)
 *   online:{shop}:{userId}     -> StoredSession (with TTL, from token exchange)
 *   oauth_state:{nonce}        -> shop domain string (10-minute TTL)
 */
export class SessionStore {
  constructor(private kv: CloudflareKvCacheStore) {}

  async getOfflineSession(shop: string): Promise<StoredSession | null> {
    const raw = await this.kv.get(`offline:${shop}`);
    if (!raw) return null;
    return parseStoredSession(raw);
  }

  async setOfflineSession(shop: string, session: StoredSession): Promise<void> {
    await this.kv.put(`offline:${shop}`, serializeValue(session));
  }

  async deleteOfflineSession(shop: string): Promise<void> {
    await this.kv.delete(`offline:${shop}`);
  }

  async getOnlineSession(
    shop: string,
    userId: string,
  ): Promise<StoredSession | null> {
    const raw = await this.kv.get(`online:${shop}:${userId}`);
    if (!raw) return null;
    const session = parseStoredSession(raw);

    if (session.expiresAt && new Date(session.expiresAt) <= new Date()) {
      return null;
    }

    return session;
  }

  async setOnlineSession(
    shop: string,
    userId: string,
    session: StoredSession,
    ttlSeconds: number,
  ): Promise<void> {
    await this.kv.put(`online:${shop}:${userId}`, serializeValue(session), {
      expirationTtl: ttlSeconds,
    });
  }

  async setOAuthState(nonce: string, shop: string): Promise<void> {
    await this.kv.put(`oauth_state:${nonce}`, shop, {
      expirationTtl: 600,
    });
  }

  async getAndDeleteOAuthState(nonce: string): Promise<string | null> {
    const key = `oauth_state:${nonce}`;
    const shop = await this.kv.get(key);
    if (shop) {
      await this.kv.delete(key);
    }
    return shop;
  }
}

function parseStoredSession(raw: string): StoredSession {
  const session = deserializeValue<StoredSession>(raw);
  if (!session) {
    throw new SyntaxError("Invalid stored session JSON");
  }
  return session;
}
