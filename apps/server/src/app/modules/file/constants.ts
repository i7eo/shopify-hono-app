import { capitalize } from "@shamt/utils";
import { getEnvProvider } from "@/infra/provider";

const env = getEnvProvider();

export const apiPath = `/${env.APP_API_PREFIX}/files`;
export const tag = `${capitalize(env.APP_API_PREFIX)} - File`;
export const tags = [tag];
