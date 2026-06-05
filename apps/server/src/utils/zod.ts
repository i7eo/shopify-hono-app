import type { z } from "zod";

export function formatZodError(error: z.ZodError): string {
  return `Invalid env: ${error.issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ")}`;
}
