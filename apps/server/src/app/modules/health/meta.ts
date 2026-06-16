import { createRoute, z } from "@hono/zod-openapi";
import { ErrorSchema, ResponseSchema } from "@/shared/models";
import { apiPath, tags } from "./constants";

const HealthStatusSchema = z.enum(["ok", "unsupported", "reserved"]);

export const HealthDataSchema = z.object({
  status: z.literal("ok").openapi({
    description: "Server health status.",
    example: "ok",
  }),
});
export const getHealthRoute = createRoute({
  method: "get",
  path: apiPath,
  tags,
  summary: "Health check",
  description: "Check whether the server is running.",
  responses: {
    200: {
      description: "Server is healthy.",
      content: {
        "application/json": {
          schema: ResponseSchema(HealthDataSchema),
        },
      },
    },
  },
});

export const DiskHealthDataSchema = z.object({
  status: HealthStatusSchema.openapi({
    description: "Disk check status.",
    example: "ok",
  }),
  target: z.literal("disk").openapi({
    description: "Health check target.",
    example: "disk",
  }),
  runtime: z.string().openapi({
    description: "Application runtime used for this check.",
    example: "node",
  }),
  path: z.string().optional().openapi({
    description: "Checked filesystem path when disk access is supported.",
    example: "/app",
  }),
});
export const getDiskHealthRoute = createRoute({
  method: "get",
  path: `${apiPath}/disk`,
  tags,
  summary: "Disk health check",
  description: "Check filesystem availability when the runtime supports it.",
  responses: {
    200: {
      description: "Disk health result.",
      content: {
        "application/json": {
          schema: ResponseSchema(DiskHealthDataSchema),
        },
      },
    },
  },
});

export const MemoryHealthDataSchema = z.object({
  status: HealthStatusSchema.openapi({
    description: "Memory check status.",
    example: "ok",
  }),
  target: z.literal("memory").openapi({
    description: "Health check target.",
    example: "memory",
  }),
  runtime: z.string().openapi({
    description: "Application runtime used for this check.",
    example: "node",
  }),
  rss: z.number().int().optional().openapi({
    description: "Resident set size in bytes.",
    example: 73400320,
  }),
  heapTotal: z.number().int().optional().openapi({
    description: "Total V8 heap size in bytes.",
    example: 31457280,
  }),
  heapUsed: z.number().int().optional().openapi({
    description: "Used V8 heap size in bytes.",
    example: 18874368,
  }),
  external: z.number().int().optional().openapi({
    description: "External memory in bytes.",
    example: 4194304,
  }),
  arrayBuffers: z.number().int().optional().openapi({
    description: "ArrayBuffer memory in bytes.",
    example: 1048576,
  }),
});
export const getMemoryHealthRoute = createRoute({
  method: "get",
  path: `${apiPath}/memory`,
  tags,
  summary: "Memory health check",
  description: "Check runtime memory metrics when available.",
  responses: {
    200: {
      description: "Memory health result.",
      content: {
        "application/json": {
          schema: ResponseSchema(MemoryHealthDataSchema),
        },
      },
    },
  },
});

export const NetworkHealthDataSchema = z.object({
  status: z.literal("ok").openapi({
    description: "Network check status.",
    example: "ok",
  }),
  target: z.literal("network").openapi({
    description: "Health check target.",
    example: "network",
  }),
  reachable: z.literal(true).openapi({
    description: "Whether the network target responded successfully.",
    example: true,
  }),
  statusCode: z.number().int().openapi({
    description: "HTTP status code returned by the network target.",
    example: 200,
  }),
  latencyMs: z.number().openapi({
    description: "Measured request latency in milliseconds.",
    example: 42.5,
  }),
});
export const getNetworkHealthRoute = createRoute({
  method: "get",
  path: `${apiPath}/network`,
  tags,
  summary: "Network health check",
  description: "Check outbound network connectivity.",
  responses: {
    200: {
      description: "Network health result.",
      content: {
        "application/json": {
          schema: ResponseSchema(NetworkHealthDataSchema),
        },
      },
    },
    408: {
      description: "Network health check timed out.",
      content: {
        "application/json": {
          schema: ErrorSchema(z.null()),
        },
      },
    },
    502: {
      description: "Network health check failed.",
      content: {
        "application/json": {
          schema: ErrorSchema(z.null()),
        },
      },
    },
  },
});

export const ReservedHealthDataSchema = z.object({
  status: z.literal("reserved").openapi({
    description: "Reserved health check status.",
    example: "reserved",
  }),
  target: z.enum(["database", "redis"]).openapi({
    description: "Reserved health check target.",
    example: "database",
  }),
});
export const getDatabaseHealthRoute = createReservedHealthRoute(
  `${apiPath}/database`,
  "Database health check",
  "Reserved database health check endpoint.",
);
export const getRedisHealthRoute = createReservedHealthRoute(
  `${apiPath}/redis`,
  "Redis health check",
  "Reserved Redis health check endpoint.",
);
function createReservedHealthRoute(
  routePath: string,
  summary: string,
  description: string,
) {
  return createRoute({
    method: "get",
    path: routePath,
    tags,
    summary,
    description,
    responses: {
      200: {
        description: "Reserved health result.",
        content: {
          "application/json": {
            schema: ResponseSchema(ReservedHealthDataSchema),
          },
        },
      },
    },
  });
}
