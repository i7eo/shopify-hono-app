/// <reference types="@shopify/polaris-types" />

/* eslint-disable vars-on-top */

import type { Env } from "../configs/env";

interface ShopifyGlobal {
  idToken?: () => Promise<string>;
}

declare global {
  var __PUBLIC_ENV__: Env | undefined;
  var shopify: ShopifyGlobal | undefined;

  interface Window {
    __PUBLIC_ENV__?: Env;
    shopify?: ShopifyGlobal;
  }
}

export {};
