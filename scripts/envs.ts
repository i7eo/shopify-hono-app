import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const envName = process.argv[2] ?? process.env.APP_ENV ?? "development";
const envPath = path.resolve(
  root,
  envName.startsWith(".env") ? envName : `.env.${envName}`,
);

const targets = [
  {
    envKey: "APP__SERVER_PORT",
    tomlPath: path.resolve(root, "apps/server/shopify.web.toml"),
  },
  {
    envKey: "APP__WEB_PORT",
    tomlPath: path.resolve(root, "apps/web/shopify.web.toml"),
  },
] as const;

function parseEnv(source: string) {
  const envs = new Map<string, string>();

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // eslint-disable-next-line regexp/no-super-linear-backtracking
    const match = /^(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/.exec(trimmed);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    envs.set(key, normalizeEnvValue(rawValue));
  }

  return envs;
}

function normalizeEnvValue(value: string) {
  const trimmed = value.trim();
  const quote = trimmed[0];

  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }

  const commentIndex = trimmed.search(/\s#/);

  if (commentIndex === -1) {
    return trimmed;
  }

  return trimmed.slice(0, commentIndex).trim();
}

function getPort(envs: Map<string, string>, key: string) {
  const value = envs.get(key);

  if (!value) {
    throw new Error(`${key} is missing in ${path.relative(root, envPath)}`);
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(`${key} must be a number, received "${value}"`);
  }

  const port = Number(value);

  if (port < 1 || port > 65535) {
    throw new Error(`${key} must be between 1 and 65535, received ${port}`);
  }

  return port;
}

async function updateTomlPort(tomlPath: string, port: number) {
  const toml = await readToml(tomlPath);
  const portPattern = /^port\s*=\s*\d+$/m;

  const updated = portPattern.test(toml)
    ? toml.replace(portPattern, `port = ${port}`)
    : insertTomlPort(toml, port);

  await writeFile(tomlPath, updated);
}

async function readToml(tomlPath: string) {
  try {
    return await readFile(tomlPath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`${path.relative(root, tomlPath)} does not exist`, {
        cause: error,
      });
    }

    throw error;
  }
}

function insertTomlPort(toml: string, port: number) {
  const portLine = `port = ${port}`;
  const firstSectionIndex = toml.search(/^\[/m);

  if (firstSectionIndex === -1) {
    return `${trimTrailingNewlines(toml)}\n${portLine}\n`;
  }

  const beforeSection = trimTrailingNewlines(toml.slice(0, firstSectionIndex));
  const sectionAndAfter = toml.slice(firstSectionIndex);

  return `${beforeSection}\n${portLine}\n\n${sectionAndAfter}`;
}

function trimTrailingNewlines(value: string) {
  return value.replace(/\n*$/, "");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

const envs = parseEnv(await readFile(envPath, "utf8"));

for (const target of targets) {
  await updateTomlPort(target.tomlPath, getPort(envs, target.envKey));
}

// TODO: 自动写入 wrangler kv
// 引入 envs 校验
