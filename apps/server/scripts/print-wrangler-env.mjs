const keys = [
  "APP_ENV",
  "APP_RUNTIME",
  "APP_LOGGER_EXPIRE",
  "APP__SERVER_PORT",
  "APP__WEB_PORT",
  "HOST",
  "APP_URL",
  "SERVER_PORT",
  "BACKEND_PORT",
  "FRONTEND_PORT",
  "PORT",
  "SHOPIFY_API_KEY",
];

const isRealWranglerCli = process.argv[1]?.includes("wrangler-dist/cli.js");

if (isRealWranglerCli) {
  console.log("[wrangler process env]", {
    pid: process.pid,
    cwd: process.cwd(),
    argv: process.argv,
    env: Object.fromEntries(
      keys.map((key) => [key, process.env[key] ?? "<missing>"]),
    ),
  });
}
