// ---------------------------------------------------------------------------
// Shopify Session Token (JWT) Claims
// ---------------------------------------------------------------------------

export interface ShopifySessionTokenClaims {
  /** Issuer: https://{shop}.myshopify.com/admin */
  iss: string;
  /** Destination: https://{shop}.myshopify.com */
  dest: string;
  /** Audience: the app's client ID (SHOPIFY_APP_KEY) */
  aud: string;
  /** Subject: the ID of the user who initiated the request */
  sub: string;
  /** Expiration time (unix seconds) */
  exp: number;
  /** Not before (unix seconds) */
  nbf: number;
  /** Issued at (unix seconds) */
  iat: number;
  /** Unique token identifier */
  jti: string;
  /** Session ID */
  sid: string;
}

// ---------------------------------------------------------------------------
// Shopify API responses
// ---------------------------------------------------------------------------

export interface ShopifyAccessTokenResponse {
  access_token: string;
  scope: string;
}

export interface ShopifyTokenExchangeResponse {
  access_token: string;
  scope?: string;
  expires_in: number;
  associated_user_scope: string;
  associated_user: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    email_verified: boolean;
    account_owner: boolean;
    locale: string;
    collaborator: boolean;
  };
}

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
  extensions?: {
    cost?: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}
