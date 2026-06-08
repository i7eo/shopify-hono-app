import { getEnvProvider } from "@/infra/provider";

const env = getEnvProvider(process.env);

export const apiPath = `/${env.APP_GLOBAL_PREFIX}/shopify`;
export const tags = ["API - Shopify"];
