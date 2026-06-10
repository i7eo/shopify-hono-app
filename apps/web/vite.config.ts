import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { escape as escapeHTML } from "@shamt/utils";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { name } from "./package.json";

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  plugins: [
    shopifyHtmlEnvPlugin(mode),
    tailwindcss(),
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
  ],
}));

function shopifyHtmlEnvPlugin(mode: string): Plugin {
  const env = {
    ...loadEnv(mode, resolve(__dirname, "../.."), ""),
    ...process.env,
  };

  const shopifyApiKey = env.SHOPIFY_API_KEY ?? env.SHOPIFY_APP_KEY;

  return {
    name: "shopify-html-env",
    enforce: "pre",
    transformIndexHtml(html) {
      if (!shopifyApiKey) {
        throw new Error(
          "SHOPIFY_API_KEY or SHOPIFY_APP_KEY is required to render apps/web/index.html",
        );
      }

      return html
        .replaceAll("%SHOPIFY_APP_FRONTEND_NAME%", escapeHTML(name))
        .replaceAll(
          "%SHOPIFY_APP_FRONTEND_HEAD%",
          renderShopifyHead(shopifyApiKey),
        );
    },
  };
}

function renderShopifyHead(shopifyApiKey: string | undefined) {
  if (!shopifyApiKey) {
    return " ";
  }

  return [
    `<meta name="shopify-api-key" content="${escapeHTML(shopifyApiKey)}" />`,
    `<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>`,
    `<script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script>`,
  ].join("\n    ");
}
