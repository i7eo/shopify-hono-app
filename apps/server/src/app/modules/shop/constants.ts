import { capitalize } from "@shamt/utils";
import { getEnvProvider } from "@/infra/provider";

const env = getEnvProvider();

export const apiPath = `/${env.APP_API_PREFIX}/shop`;
export const tag = `${capitalize(env.APP_API_PREFIX)} - Shop`;
export const tags = [tag];
