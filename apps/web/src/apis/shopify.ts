import { apiClient, HttpRequestError } from "@/utils/client";
import {
  isEmbeddedShopifyApp,
  isStandaloneShopifyAppMode,
} from "@/utils/public-env";

export interface ApiResponse<TData> {
  data?: TData;
}

export interface ShopInfo {
  name?: string;
  myshopifyDomain?: string;
}

export interface ProductNode {
  id: string;
  title: string;
}

export interface ProductsData {
  products?: {
    edges?: Array<{
      node: ProductNode;
    }>;
  };
}

export class ShopifyAuthRedirectError extends Error {
  override name = "ShopifyAuthRedirectError";
}

let sessionTokenPromise: Promise<string> | undefined;
let authRedirectState:
  | {
      shop: string;
      startedAt: number;
    }
  | undefined;

const AUTH_REDIRECT_THROTTLE_MS = 3000;

/**
 * Fetches shop profile data through the app backend.
 */
export function fetchShopInfo(signal: AbortSignal) {
  return shopifyApiGet<ApiResponse<{ shop?: ShopInfo }>>("shop", signal);
}

/**
 * Fetches the product list through the app backend.
 */
export function fetchProducts(signal: AbortSignal) {
  return shopifyApiGet<ApiResponse<ProductsData>>("product", signal);
}

/**
 * Sends authenticated Shopify API requests and starts OAuth recovery on 401s.
 */
async function shopifyApiGet<TResponse>(
  input: string,
  signal: AbortSignal,
): Promise<TResponse> {
  return apiClient
    .get<TResponse>(input, {
      credentials: isStandaloneShopifyAppMode() ? "include" : "same-origin",
      headers: await getShopifyApiHeaders(),
      signal,
    })
    .then((response) => {
      resetAuthRedirectState();
      return response;
    })
    .catch((error) => {
      if (error instanceof HttpRequestError && error.status === 401) {
        redirectToAuth();
        throw new ShopifyAuthRedirectError(
          "Shopify authorization is required",
          {
            cause: error,
          },
        );
      }

      throw error;
    });
}

/**
 * Builds mode-specific headers for embedded App Bridge or standalone cookies.
 */
async function getShopifyApiHeaders() {
  const headers = new Headers();

  if (isEmbeddedShopifyApp()) {
    headers.set("Authorization", `Bearer ${await getSessionToken()}`);
  }

  return headers;
}

/**
 * Reuses an in-flight App Bridge token request to avoid duplicate work.
 */
function getSessionToken() {
  sessionTokenPromise ??= readSessionToken().finally(() => {
    sessionTokenPromise = undefined;
  });

  return sessionTokenPromise;
}

/**
 * Reads a fresh embedded session token from Shopify App Bridge.
 */
function readSessionToken() {
  const idToken = globalThis.shopify?.idToken;

  if (!idToken) {
    throw new Error("Shopify App Bridge session token API is unavailable");
  }

  return idToken();
}

/**
 * Redirects to OAuth once per shop within the throttle window.
 */
function redirectToAuth() {
  const shop = new URLSearchParams(globalThis.location.search).get("shop");

  if (!shop) {
    return;
  }

  const now = Date.now();

  if (
    authRedirectState?.shop === shop &&
    now - authRedirectState.startedAt < AUTH_REDIRECT_THROTTLE_MS
  ) {
    return;
  }

  authRedirectState = { shop, startedAt: now };

  const authUrl = new URL("/auth", globalThis.location.origin);
  authUrl.searchParams.set("shop", shop);
  globalThis.open(authUrl.toString(), "_top");
}

/**
 * Allows future 401 responses to start a new auth redirect.
 */
function resetAuthRedirectState() {
  authRedirectState = undefined;
}
