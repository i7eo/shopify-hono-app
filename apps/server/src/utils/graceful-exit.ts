import { closeCache } from "../modules/cache";
import logger from "../modules/logger";
import { clients } from "../shared/clients";
import { crons } from "../shared/crons";

/**
 * 进程退出信号列表，用于注册优雅退出监听器。
 * 注意：SIGKILL (9) 无法被捕获或忽略，已排除。
 * - SIGINT: Ctrl+C 触发
 * - SIGQUIT: Ctrl+\ 触发
 * - SIGTERM: kill 命令默认发送，Docker/K8s 停止容器时发送
 */
export const exitSignals = ["SIGINT", "SIGQUIT", "SIGTERM"] as const;

/**
 * 优雅退出超时时间（毫秒）。
 * 若 cleanup 在此时间内未完成，将强制 process.exit(1) 避免进程挂起。
 */
export const SHUTDOWN_TIMEOUT_MS = 10000;

/**
 * 防重复退出标志。
 * 快速多次按 Ctrl+C 时，仅第一个信号会触发完整清理流程；
 * 后续信号直接忽略，避免重复执行 cleanup 导致的竞态。
 */
let isShuttingDown = false;

/**
 * 处理进程退出信号的统一入口，执行优雅关闭流程。
 *
 * 流程：
 * 1. 检查 isShuttingDown，避免重复执行
 * 2. 移除所有 process 监听器，防止后续信号再次触发
 * 3. 设置超时定时器，超时则强制退出
 * 4. 执行 cleanup 并等待完成
 * 5. 成功则 process.exit(0)，失败则 process.exit(1)
 *
 * @param _signal - 收到的信号（如 SIGTERM），当前未使用
 * @param cleanup - 异步清理函数，需按顺序关闭 server、cron、clients 等资源
 */
export async function gracefulExit(
  _signal: string,
  cleanup: () => Promise<void>,
): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  process.removeAllListeners();

  const timeout = setTimeout(() => {
    logger.warn("📷 Graceful shutdown timeout, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    await cleanup();
    logger.info("📷 Graceful exit completed");
    clearTimeout(timeout);
    process.exit(0);
  } catch (error) {
    logger.error({ error, $message: "📷 Error during graceful shutdown" });
    clearTimeout(timeout);
    process.exit(1);
  }
}

/**
 * 为当前进程注册退出信号监听器。
 * 收到 exitSignals 中的任一信号时，调用 gracefulExit 执行 cleanup。
 *
 * @param _server - server 实例（未使用，仅用于类型签名统一）
 * @param cleanup - 异步清理函数
 */
export function registerGracefulExitHandlers(
  _server: ReturnType<typeof Bun.serve>,
  cleanup: () => Promise<void>,
) {
  exitSignals.forEach((signal) =>
    process.on(signal, () => gracefulExit(signal, cleanup)),
  );
}

/**
 * 创建 Worker/单进程的清理函数，按依赖顺序关闭资源。
 *
 * 执行顺序（重要）：
 * 1. server.stop() - 停止接受新请求，等待进行中请求完成
 * 2. 停止 cron - 避免新定时任务启动
 * 3. 关闭 Lark WebSocket - 长连接断开
 * 4. 关闭 shared Redis - 业务用 Redis（auth、aggregator 等）
 * 5. closeCache() - 关闭 cache 模块的 Redis（若使用 Redis 缓存）
 *
 * @param server - Bun.serve 返回的 server 实例
 * @returns 异步清理函数，供 gracefulExit 调用
 */
export function setupCleanup(server: ReturnType<typeof Bun.serve>) {
  return async () => {
    await server.stop();
    crons.get("autoSummary")?.stop();
    clients.get("larkws")?.close({ force: true });
    clients.get("redis")?.close();
    closeCache();
  };
}
