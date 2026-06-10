export const DEFAULT_SHOPIFY_APP_MODES = {
  EMBEDDED: "embedded",
  STANDALONE: "standalone",
} as const;
export type DEFAULT_SHOPIFY_APP_MODES_VALUES =
  (typeof DEFAULT_SHOPIFY_APP_MODES)[keyof typeof DEFAULT_SHOPIFY_APP_MODES];
