/// <reference types="@shopify/polaris-types" />
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="@shopify/app-bridge-types" />

/* eslint-disable vars-on-top */

import type { Env } from "../configs/env";
import type {
  SAppNavAttributes,
  SAppNavLinkAttributes,
} from "@shopify/app-bridge-types";

declare global {
  var __PUBLIC_ENV__: Env | undefined;

  interface Window {
    __PUBLIC_ENV__?: Env;
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": SAppNavAttributes;
      // @ts-expect-error Merge App Bridge app-nav link attributes into Polaris' s-link type.
      "s-link": IntrinsicElements["s-link"] &
        Pick<SAppNavLinkAttributes, "rel">;
    }
  }
}

export {};
