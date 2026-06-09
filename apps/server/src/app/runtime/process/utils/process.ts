export function getSafeProcessEnv(): Record<string, unknown> {
  return typeof process === "undefined" ? {} : process.env;
}

// // avoid barrel import casue v8 isolate(cloudflare) start error
// export * from "./disk";
// export * from "./net";
