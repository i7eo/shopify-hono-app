import { DEFAULT_APP_API_PREFIX } from "@shamt/envs";
import { capitalize } from "@shamt/utils";

const globalPrefix =
  typeof process !== "undefined" && process.env.APP_API_PREFIX
    ? process.env.APP_API_PREFIX
    : DEFAULT_APP_API_PREFIX;

export const apiPath = `/${globalPrefix}/shopify`;
export const tag = `${capitalize(globalPrefix)} - Shopify`;
export const tags = [tag];
