import { getEnvProvider } from "@/infra/provider";

const env = getEnvProvider(process.env);

export const path = `/${env.APP_GLOBAL_PREFIX}/health`;
export const tags = [`API - Health`];
