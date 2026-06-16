import { getRuntimeCapability } from "@/app/runtime/capabilities";
import { getClientProvider } from "@/infra/provider";
import { internalServerError } from "@/shared/exceptions";
import type {
  DiskHealthDataSchema,
  HealthDataSchema,
  MemoryHealthDataSchema,
  NetworkHealthDataSchema,
  ReservedHealthDataSchema,
} from "./meta";
import type { RuntimeConfig } from "@/infra/env";
import type { AppEnv } from "@/typings";
import type { z } from "@hono/zod-openapi";
import type { Context } from "hono";

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

/**
 * Runs the module health disk check through the active runtime capability.
 */
export async function checkDiskHealth(
  c: Context<AppEnv>,
): Promise<DiskHealthData> {
  const moduleHealthProcessDiskChecker = getRuntimeCapability(
    "moduleHealthProcessDiskChecker",
  );

  if (!moduleHealthProcessDiskChecker) {
    throw internalServerError(
      "Module health disk checker capability is not registered",
    );
  }

  const result = await moduleHealthProcessDiskChecker(c);

  return {
    status: result.status,
    target: "disk",
    runtime: result.runtime,
    path: result.path,
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

export async function checkNetworkHealth(
  runtimeConfig: RuntimeConfig,
): Promise<NetworkHealthData> {
  const start = performance.now();
  const httpClient = getClientProvider(runtimeConfig);
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
