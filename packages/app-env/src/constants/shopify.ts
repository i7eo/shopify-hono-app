export const DEFAULT_SHOPIFY_APP_MODES = {
  EMBEDDED: "embedded",
  STANDALONE: "standalone",
} as const;
export type DEFAULT_SHOPIFY_APP_MODES_VALUES =
  (typeof DEFAULT_SHOPIFY_APP_MODES)[keyof typeof DEFAULT_SHOPIFY_APP_MODES];

export const DEFAULT_SHOPIFY_WEB_ROLES = {
  FRONTEND: "frontend",
  BACKEND: "backend",
} as const;
export type DEFAULT_SHOPIFY_WEB_ROLES_VALUES =
  (typeof DEFAULT_SHOPIFY_WEB_ROLES)[keyof typeof DEFAULT_SHOPIFY_WEB_ROLES];
