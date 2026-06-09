export interface Disposable {
  dispose: () => void;
}

/**
 * Collect request-scoped resources and release them in LIFO order.
 *
 * @example
 * ```ts
 * const scope = new RequestScope();
 * scope.add(() => clearTimeout(timeoutId));
 * scope.dispose();
 * ```
 */
export class RequestScope implements Disposable {
  private readonly disposables: Disposable[] = [];
  private disposed = false;

  /**
   * Register a cleanup callback or disposable object.
   *
   * @example
   * ```ts
   * const scope = new RequestScope();
   * scope.add({ dispose: () => controller.abort() });
   * ```
   */
  add(disposable: Disposable | (() => void)): void {
    if (this.disposed) {
      if (typeof disposable === "function") {
        disposable();
        return;
      }
      disposable.dispose();
      return;
    }

    this.disposables.push(
      typeof disposable === "function" ? { dispose: disposable } : disposable,
    );
  }

  /**
   * Release all registered resources exactly once.
   *
   * @example
   * ```ts
   * const scope = new RequestScope();
   * scope.add(() => log.push("disposed"));
   * scope.dispose();
   * scope.dispose(); // No-op.
   * ```
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    for (let index = this.disposables.length - 1; index >= 0; index -= 1) {
      this.disposables[index]?.dispose();
    }
    this.disposables.length = 0;
  }
}
