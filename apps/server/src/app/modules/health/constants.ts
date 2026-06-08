import { capitalize } from "@shamt/utils";
import { getEnvProvider } from "@/infra/provider";

const env = getEnvProvider(process.env);

export const apiPath = `/${env.APP_GLOBAL_PREFIX}/health`;
export const tag = `${capitalize(env.APP_GLOBAL_PREFIX)} - Health`;
export const tags = [tag];
