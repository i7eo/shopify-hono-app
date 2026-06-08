import {
  ApiVersion,
  LogSeverity,
  shopifyApi,
  type Shopify,
} from "@shopify/shopify-api";
import type { RuntimeConfig } from "@/infra/env";
import type { Logger } from "@/infra/logger";
import "@shopify/shopify-api/adapters/web-api";

const apiVersions: Record<string, ApiVersion> = {
  "2026-04": ApiVersion.April26,
};

export function createShopifyConfig(
  config: RuntimeConfig,
  logger: Logger,
): Shopify {
  const appUrl = new URL(config.SHOPIFY_APP_URL);

  return shopifyApi({
    apiKey: config.SHOPIFY_APP_KEY,
    apiSecretKey: config.SHOPIFY_APP_SECRET,
    apiVersion: getShopifyApiVersion(config.SHOPIFY_API_VERSION),
    hostName: appUrl.host,
    hostScheme: appUrl.protocol === "http:" ? "http" : "https",
    isEmbeddedApp: true,
    logger: {
      level: LogSeverity.Info,
      log: (severity, message) => {
        logShopifyMessage(logger, severity, message);
      },
    },
    scopes: config.SCOPES.split(",")
      .map((scope) => scope.trim())
      .filter(Boolean),
  });
}

function getShopifyApiVersion(version: string): ApiVersion {
  const apiVersion = apiVersions[version.trim()];
  if (!apiVersion) {
    throw new Error(`Unsupported Shopify API version: ${version}`);
  }
  return apiVersion;
}

function logShopifyMessage(
  logger: Logger,
  severity: LogSeverity,
  message: string,
) {
  switch (severity) {
    case LogSeverity.Debug: {
      logger.debug(message);
      break;
    }
    case LogSeverity.Info: {
      logger.info(message);
      break;
    }
    case LogSeverity.Warning: {
      logger.warn(message);
      break;
    }
    case LogSeverity.Error: {
      logger.error(message);
      break;
    }
  }
}
