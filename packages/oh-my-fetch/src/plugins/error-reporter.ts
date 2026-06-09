import type { ErrorReporter, HttpPlugin } from "../utils/types";

/**
 * Create an opt-in plugin that reports normalized request errors.
 *
 * @example
 * ```ts
 * const client = createHttpClient({
 *   plugins: [errorReporterPlugin({ report: (error) => console.error(error) })],
 * });
 * ```
 */
export function errorReporterPlugin(reporter: ErrorReporter): HttpPlugin {
  return {
    name: "error-reporter",
    beforeError: async (error, context) => {
      await reporter.report(error, { ...context, error });
      return error;
    },
  };
}
