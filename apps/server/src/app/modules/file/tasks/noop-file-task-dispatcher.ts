export type FileTask =
  | { type: "expire-file"; fileId: string }
  | { type: "delete-object"; fileId: string; bucketKey: string };

export interface FileTaskDispatcher {
  dispatch: (task: FileTask) => Promise<void>;
}

/**
 * Placeholder dispatcher used before pg-boss or Cloudflare Queues are wired in.
 */
export class NoopFileTaskDispatcher implements FileTaskDispatcher {
  /**
   * Logs the task and resolves without enqueueing side effects.
   */
  async dispatch(_task: FileTask): Promise<void> {
    await console.info(_task);
    return;
  }
}
