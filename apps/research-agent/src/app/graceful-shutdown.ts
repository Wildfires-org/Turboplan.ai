import { shutdownAnalytics } from "../infra/analytics";
import { logger } from "../infra/logger";
import type { RunManager } from "../runs/run-manager";

export const registerGracefulShutdown = (runManager: RunManager): void => {
  const handleShutdown = async () => {
    logger.log("Received shutdown signal, cleaning up...", "server");
    // Force-exit if cleanup hangs (e.g. stuck DB write) — don't rely on SIGKILL from the orchestrator.
    const timeout = setTimeout(() => process.exit(1), 10_000);
    await runManager.shutdown();
    await shutdownAnalytics().catch((err) => {
      logger.error("Failed to flush analytics during shutdown", err);
    });
    clearTimeout(timeout);
    process.exit(0);
  };

  process.on("SIGTERM", handleShutdown);
  process.on("SIGINT", handleShutdown);
};
