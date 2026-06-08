import { DEFAULT_RUNTIMES } from "@shamt/envs";
import { getClientProvider } from "@/infra/provider";
import type {
  DiskHealthDataSchema,
  HealthDataSchema,
  MemoryHealthDataSchema,
  NetworkHealthDataSchema,
  ReservedHealthDataSchema,
} from "./meta";
import type { RuntimeConfig } from "@/infra/env";
import type { z } from "@hono/zod-openapi";

export type HealthData = z.infer<typeof HealthDataSchema>;
export type DiskHealthData = z.infer<typeof DiskHealthDataSchema>;
export type MemoryHealthData = z.infer<typeof MemoryHealthDataSchema>;
export type NetworkHealthData = z.infer<typeof NetworkHealthDataSchema>;
export type ReservedHealthData = z.infer<typeof ReservedHealthDataSchema>;

type ReservedHealthTarget = ReservedHealthData["target"];

const NETWORK_HEALTH_URL = "https://example.com";

export function getHealthStatus(): HealthData {
  return { status: "ok" };
}

export async function checkDiskHealth(
  runtimeConfig: RuntimeConfig,
): Promise<DiskHealthData> {
  if (runtimeConfig.APP_RUNTIME !== DEFAULT_RUNTIMES.NODE) {
    return {
      status: "unsupported",
      target: "disk",
      runtime: runtimeConfig.APP_RUNTIME,
    };
  }

  const { access } = await import("node:fs/promises");
  const { constants } = await import("node:fs");
  const diskPath = process.cwd();

  await access(diskPath, constants.R_OK | constants.W_OK);

  return {
    status: "ok",
    target: "disk",
    runtime: runtimeConfig.APP_RUNTIME,
    path: diskPath,
  };
}

export function checkMemoryHealth(
  runtimeConfig: RuntimeConfig,
): MemoryHealthData {
  const memoryUsage =
    typeof process !== "undefined" && typeof process.memoryUsage === "function"
      ? process.memoryUsage()
      : undefined;

  if (!memoryUsage) {
    return {
      status: "unsupported",
      target: "memory",
      runtime: runtimeConfig.APP_RUNTIME,
    };
  }

  return {
    status: "ok",
    target: "memory",
    runtime: runtimeConfig.APP_RUNTIME,
    rss: memoryUsage.rss,
    heapTotal: memoryUsage.heapTotal,
    heapUsed: memoryUsage.heapUsed,
    external: memoryUsage.external,
    arrayBuffers: memoryUsage.arrayBuffers,
  };
}

export async function checkNetworkHealth(): Promise<NetworkHealthData> {
  const start = performance.now();
  const httpClient = getClientProvider();
  const response = await httpClient.get<Response>(NETWORK_HEALTH_URL, {
    responseType: "response",
  });

  return {
    status: "ok",
    target: "network",
    reachable: true,
    statusCode: response.status,
    latencyMs: getLatencyMs(start),
  };
}

export function getReservedHealthStatus(
  target: ReservedHealthTarget,
): ReservedHealthData {
  return {
    status: "reserved",
    target,
  };
}

function getLatencyMs(start: number): number {
  return Math.round((performance.now() - start) * 100) / 100;
}
