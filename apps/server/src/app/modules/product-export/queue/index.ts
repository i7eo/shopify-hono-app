import { getRuntimeCapability } from "@/app/runtime/capabilities";
import { badGatewayError } from "@/shared/exceptions";
import type { PRODUCT_EXPORT_QUEUE_JOBS } from "./constants";
import type { QueueJobContext, QueueMessage } from "@/infra/queue";
import type { AppEnv } from "@/typings";
import type { Context } from "hono";

export type ProductExportJobPayload = {
  exportId: string;
  seq?: number;
  shopDomain: string;
};

export type ProductExportReconcilePayload = Record<string, never>;

export type ProductExportJobName =
  (typeof PRODUCT_EXPORT_QUEUE_JOBS)[keyof typeof PRODUCT_EXPORT_QUEUE_JOBS];

/**
 * Creates the normalized queue envelope consumed by infra/queue.
 */
export function createProductExportQueueMessage<
  TPayload extends Record<string, unknown>,
>(name: ProductExportJobName, payload: TPayload, requestId?: string) {
  return {
    name,
    payload,
    requestId,
    version: 1,
  } satisfies QueueMessage<ProductExportJobName, TPayload>;
}

/**
 * Enqueues a product-export job from an HTTP/webhook request context.
 */
export async function enqueueProductExportJob(
  c: Context<AppEnv>,
  name: ProductExportJobName,
  payload: ProductExportJobPayload | ProductExportReconcilePayload,
): Promise<void> {
  const queueProducerFactory = getRuntimeCapability("queueProducerFactory");

  if (!queueProducerFactory) {
    throw badGatewayError(
      "Runtime capability is not registered: queueProducerFactory",
      {
        expose: true,
      },
    );
  }

  const producer = await queueProducerFactory(c);
  await producer.enqueue(
    createProductExportQueueMessage(name, payload, c.get("requestId")),
    {
      idempotencyKey: createIdempotencyKey(name, payload),
      maxAttempts: c.get("runtimeEnv").APP_QUEUE_CONSUMER_MAX_RETRIES,
    },
  );
}

/**
 * Enqueues a single product-export job from queue/scheduler context.
 *
 * Example: reconcile can schedule `product-export.process-part` without a
 * Hono request by using runtime bindings stored on the job context.
 */
export async function enqueueProductExportJobFromContext(
  context: QueueJobContext,
  name: ProductExportJobName,
  payload: ProductExportJobPayload | ProductExportReconcilePayload,
): Promise<void> {
  const producer = await createQueueProducerFromContext(context);

  await producer.enqueue(createProductExportQueueMessage(name, payload), {
    idempotencyKey: createIdempotencyKey(name, payload),
    maxAttempts: context.runtimeEnv.APP_QUEUE_CONSUMER_MAX_RETRIES,
  });
}

/**
 * Enqueues many product-export jobs from queue/scheduler context.
 */
export async function enqueueProductExportJobsFromContext(
  context: QueueJobContext,
  name: ProductExportJobName,
  payloads: ProductExportJobPayload[],
): Promise<void> {
  if (payloads.length === 0) return;

  const producer = await createQueueProducerFromContext(context);

  await producer.enqueueBatch(
    payloads.map((payload) => createProductExportQueueMessage(name, payload)),
    {
      maxAttempts: context.runtimeEnv.APP_QUEUE_CONSUMER_MAX_RETRIES,
    },
  );
}

function createQueueProducerFromContext(context: QueueJobContext) {
  const factory = getRuntimeCapability("queueProducerFactory");

  if (!factory) {
    throw badGatewayError(
      "Runtime capability is not registered: queueProducerFactory",
      {
        expose: true,
      },
    );
  }

  return factory({
    env: context.bindings ?? {},
    get(key: string) {
      if (key === "runtimeEnv") return context.runtimeEnv;
      if (key === "runtimeLogger") return context.logger;
      return;
    },
  } as Context<AppEnv>);
}

/**
 * Builds a stable queue idempotency key for providers that support it.
 */
function createIdempotencyKey(
  name: ProductExportJobName,
  payload: ProductExportJobPayload | ProductExportReconcilePayload,
): string {
  if ("exportId" in payload) {
    return [
      name,
      payload.exportId,
      payload.seq === undefined ? "" : String(payload.seq),
    ].join(":");
  }

  return name;
}
