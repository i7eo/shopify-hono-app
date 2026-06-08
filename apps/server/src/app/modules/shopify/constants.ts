import { capitalize } from "@shamt/utils";
import { getEnvProvider } from "@/infra/provider";

const env = getEnvProvider(process.env);

export const apiPath = `/${env.APP_GLOBAL_PREFIX}/shopify`;
export const tag = `${capitalize(env.APP_GLOBAL_PREFIX)} - Shopify`;
export const tags = [tag];
