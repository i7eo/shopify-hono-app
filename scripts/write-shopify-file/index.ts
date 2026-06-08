import {
  appShopifyTargets,
  shopifyAppPath,
  shopifyRedirectPaths,
} from "./constants";
import {
  fileExists,
  formatTomlString,
  getPort,
  getRequiredEnv,
  readEnv,
  readRequiredFile,
  replaceOrInsertSectionValue,
  replaceOrInsertTopLevelValue,
  replaceSectionArray,
  writeTextFile,
} from "./shared";

async function updateTomlPort(tomlPath: string, port: number) {
  const toml = await readRequiredFile(tomlPath);
  const updated = replaceOrInsertTopLevelValue(toml, "port", String(port));

  await writeTextFile(tomlPath, updated);
}

export async function writeAppShopifyFile(envs: Map<string, string>) {
  for (const target of appShopifyTargets) {
    if (
      "optional" in target &&
      target.optional &&
      !(await fileExists(target.tomlPath))
    ) {
      continue;
    }

    await updateTomlPort(target.tomlPath, getPort(envs, target.envKey));
  }
}

export async function writeShopifyFile(envs: Map<string, string>) {
  const appUrl = getRequiredEnv(envs, "SHOPIFY_APP_URL");
  const redirectUrls = shopifyRedirectPaths.map((redirectPath) => {
    return new URL(redirectPath, appUrl).toString();
  });

  let toml = await readRequiredFile(shopifyAppPath);

  toml = replaceOrInsertTopLevelValue(
    toml,
    "client_id",
    formatTomlString(getRequiredEnv(envs, "SHOPIFY_APP_KEY")),
  );
  toml = replaceOrInsertTopLevelValue(
    toml,
    "application_url",
    formatTomlString(appUrl),
  );
  toml = replaceOrInsertSectionValue(
    toml,
    "webhooks",
    "api_version",
    formatTomlString(getRequiredEnv(envs, "SHOPIFY_API_VERSION")),
  );
  toml = replaceOrInsertSectionValue(
    toml,
    "access_scopes",
    "scopes",
    formatTomlString(getRequiredEnv(envs, "SCOPES")),
  );
  toml = replaceSectionArray(toml, "auth", "redirect_urls", redirectUrls);

  await writeTextFile(shopifyAppPath, toml);
}

async function main() {
  const envs = await readEnv();
  await writeAppShopifyFile(envs);
  await writeShopifyFile(envs);
}

// eslint-disable-next-line baseline-js/use-baseline
await main();
