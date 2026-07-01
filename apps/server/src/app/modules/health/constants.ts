import { capitalize } from "@unimolecule/utils";
import { getEnvProvider } from "@/infra/provider";

const env = getEnvProvider();

export const apiPath = `/${env.APP_API_PREFIX}/health`;
export const tag = `${capitalize(env.APP_API_PREFIX)} - Health`;
export const tags = [tag];
