import type { AppEnv, GraphQLResponse } from "../types";
import type { Context } from "hono";

/**
 * Minimal typed client for the Shopify Admin GraphQL API.
 * Uses fetch directly — no external dependencies.
 */
export class ShopifyClient {
  private endpoint: string;

  constructor(
    private shop: string,
    private accessToken: string,
    apiVersion: string,
  ) {
    this.endpoint = `https://${shop}/admin/api/${apiVersion}/graphql.json`;
  }

  async query<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<GraphQLResponse<T>> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": this.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(
        `Shopify Admin API returned ${response.status}: ${await response.text()}`,
      );
    }

    return (await response.json()) as GraphQLResponse<T>;
  }
}

/**
 * Factory to create a ShopifyClient from the Hono context.
 * Requires verifySessionToken + tokenExchange middleware to have run.
 */
export function createClient(c: Context<AppEnv>): ShopifyClient {
  return new ShopifyClient(
    c.var.shopDomain,
    c.var.shopifyAccessToken,
    c.env.SHOPIFY_API_VERSION,
  );
}
