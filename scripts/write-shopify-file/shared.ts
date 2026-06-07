import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { envPath, root } from "./constants";

export function parseEnv(source: string) {
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

export async function readEnv() {
  return parseEnv(await readRequiredFile(envPath));
}

export async function readRequiredFile(filePath: string) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`${path.relative(root, filePath)} does not exist`, {
        cause: error,
      });
    }

    throw error;
  }
}

export async function writeTextFile(filePath: string, content: string) {
  await writeFile(filePath, content);
}

export function getRequiredEnv(envs: Map<string, string>, key: string) {
  const value = envs.get(key);

  if (!value) {
    throw new Error(`${key} is missing in ${path.relative(root, envPath)}`);
  }

  return value;
}

export function getPort(envs: Map<string, string>, key: string) {
  const value = getRequiredEnv(envs, key);

  if (!/^\d+$/.test(value)) {
    throw new Error(`${key} must be a number, received "${value}"`);
  }

  const port = Number(value);

  if (port < 1 || port > 65535) {
    throw new Error(`${key} must be between 1 and 65535, received ${port}`);
  }

  return port;
}

export function formatTomlString(value: string) {
  return JSON.stringify(value);
}

export function replaceOrInsertTopLevelValue(
  toml: string,
  key: string,
  value: string,
) {
  const pattern = new RegExp(String.raw`^${escapeRegExp(key)}\s*=.*$`, "m");
  const line = `${key} = ${value}`;

  if (pattern.test(toml)) {
    return toml.replace(pattern, line);
  }

  const firstSectionIndex = toml.search(/^\[/m);

  if (firstSectionIndex === -1) {
    return `${trimTrailingNewlines(toml)}\n${line}\n`;
  }

  const beforeSection = trimTrailingNewlines(toml.slice(0, firstSectionIndex));
  const sectionAndAfter = toml.slice(firstSectionIndex);

  return `${beforeSection}\n${line}\n\n${sectionAndAfter}`;
}

export function replaceOrInsertSectionValue(
  toml: string,
  section: string,
  key: string,
  value: string,
) {
  const sectionHeader = `[${section}]`;
  const entryPattern = new RegExp(
    String.raw`^${escapeRegExp(key)}\s*=\s*(?:\[[\s\S]*?^\]|.*$)`,
    "m",
  );
  const line = `${key} = ${value}`;
  const sectionStart = findSectionStart(toml, sectionHeader);

  if (sectionStart === -1) {
    return `${trimTrailingNewlines(toml)}\n\n[${section}]\n${line}\n`;
  }

  const bodyStart = sectionStart + sectionHeader.length + 1;
  const sectionEnd = findNextSectionStart(toml, bodyStart);
  const beforeSectionBody = toml.slice(0, bodyStart);
  const sectionBody = toml.slice(bodyStart, sectionEnd);
  const afterSection = toml.slice(sectionEnd);
  const updatedBody = entryPattern.test(sectionBody)
    ? sectionBody.replace(entryPattern, line)
    : `${trimTrailingNewlines(sectionBody)}\n${line}\n`;

  return `${beforeSectionBody}${updatedBody}${afterSection}`;
}

export function replaceSectionArray(
  toml: string,
  section: string,
  key: string,
  values: readonly string[],
) {
  const lines = ["[", ...values.map(formatArrayValueLine), "]"];

  return replaceOrInsertSectionValue(toml, section, key, lines.join("\n"));
}

function formatArrayValueLine(
  value: string,
  index: number,
  values: readonly string[],
) {
  const suffix = index === values.length - 1 ? "" : ",";

  return `  ${formatTomlString(value)}${suffix}`;
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

function trimTrailingNewlines(value: string) {
  return value.replace(/\n*$/, "");
}

function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function findSectionStart(toml: string, sectionHeader: string) {
  const pattern = new RegExp(
    String.raw`^${escapeRegExp(sectionHeader)}\s*$`,
    "m",
  );
  const match = pattern.exec(toml);

  return match?.index ?? -1;
}

function findNextSectionStart(toml: string, fromIndex: number) {
  const match = /^\[/m.exec(toml.slice(fromIndex));

  if (!match) {
    return toml.length;
  }

  return fromIndex + match.index;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
