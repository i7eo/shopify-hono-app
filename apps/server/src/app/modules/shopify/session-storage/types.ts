import type { Session } from "@shopify/shopify-api";

/**
 * Defines the strategy used to store sessions for the Shopify App.
 * Mirrors shopify-app-session-storage@5.0.0/src/types.ts.
 */
export interface ShopifySessionStorage {
  /**
   * Creates or updates the given session in storage.
   */
  storeSession: (session: Session) => Promise<boolean>;

  /**
   * Loads a session from storage.
   */
  loadSession: (id: string) => Promise<Session | undefined>;

  /**
   * Deletes a session from storage.
   */
  deleteSession: (id: string) => Promise<boolean>;

  /**
   * Deletes an array of sessions from storage.
   */
  deleteSessions: (ids: string[]) => Promise<boolean>;

  /**
   * Returns all sessions for a given shop.
   */
  findSessionsByShop: (shop: string) => Promise<Session[]>;
}
