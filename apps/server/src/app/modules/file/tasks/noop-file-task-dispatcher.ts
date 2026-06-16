export type FileTask =
  | { type: "expire-file"; fileId: string }
  | { type: "delete-object"; fileId: string; bucketKey: string };

export interface FileTaskDispatcher {
  dispatch: (task: FileTask) => Promise<void>;
}

export class NoopFileTaskDispatcher implements FileTaskDispatcher {
  async dispatch(_task: FileTask): Promise<void> {
    await console.info(_task);
    return;
  }
}
