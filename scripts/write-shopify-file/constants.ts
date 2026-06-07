import path from "node:path";

export const root = process.cwd();

const cliArgs = process.argv.slice(2);
const cliEnvFile = getCliOption(cliArgs, "--env-file");
const cliAppEnv = getCliAppEnv(cliArgs);

export const appEnv =
  normalizeAppEnv(cliAppEnv) ??
  getAppEnvFromEnvFile(cliEnvFile) ??
  process.env.APP_ENV ??
  "development";

export const envPath = path.resolve(
  root,
  cliEnvFile ??
    getEnvFileFromAppEnv(cliAppEnv ?? process.env.APP_ENV ?? appEnv),
);

export const appShopifyTargets = [
  {
    envKey: "APP__SERVER_PORT",
    tomlPath: path.resolve(root, "apps/server/shopify.web.toml"),
  },
  {
    envKey: "APP__WEB_PORT",
    tomlPath: path.resolve(root, "apps/web/shopify.web.toml"),
  },
] as const;

export const shopifyAppPath =
  appEnv === "production"
    ? path.resolve(root, "shopify.app.production.toml")
    : path.resolve(root, "shopify.app.toml");

export const shopifyRedirectPaths = [
  "/auth/callback",
  "/auth/shopify/callback",
  "/api/auth/callback",
] as const;

function getCliOption(args: string[], option: string) {
  for (const [index, arg] of args.entries()) {
    if (arg === option) {
      return args[index + 1];
    }

    if (arg.startsWith(`${option}=`)) {
      return arg.slice(option.length + 1);
    }
  }

  return;
}

function getCliAppEnv(args: string[]) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--env-file") {
      index += 1;
      continue;
    }

    if (arg.startsWith("--env-file=") || arg.startsWith("-")) {
      continue;
    }

    return arg;
  }

  return;
}

function normalizeAppEnv(value: string | undefined) {
  if (!value) {
    return;
  }

  if (value.startsWith(".env.")) {
    return value.slice(".env.".length);
  }

  return value;
}

function getAppEnvFromEnvFile(value: string | undefined) {
  if (!value) {
    return;
  }

  const fileName = path.basename(value);

  if (!fileName.startsWith(".env.")) {
    return;
  }

  return fileName.slice(".env.".length);
}

function getEnvFileFromAppEnv(value: string) {
  return value.startsWith(".env") ? value : `.env.${value}`;
}
