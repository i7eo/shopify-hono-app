import { validateWithSchema } from "../validation";
import type { HttpPlugin } from "../utils/types";

/**
 * Create the built-in plugin that applies request and response schemas.
 *
 * @example
 * ```ts
 * const client = createHttpClient();
 * await client.post("/users", body, { bodySchema, responseSchema });
 * ```
 */
export function validationPlugin(): HttpPlugin {
  return {
    name: "validation",
    beforeRequest: async (config) => {
      if (!config.bodySchema) {
        return config;
      }

      const body = await validateWithSchema(config.bodySchema, config.body, {
        target: "request",
        config,
      });

      return {
        ...config,
        body: body as typeof config.body,
      };
    },
    afterResponse: async (response, context) => {
      if (
        !context.config.responseSchema ||
        context.config.responseType === "response"
      ) {
        return response;
      }

      const data = await validateWithSchema(
        context.config.responseSchema,
        response.data,
        {
          target: "response",
          config: context.config,
          response,
        },
      );

      return Object.assign(response, { data });
    },
  };
}
