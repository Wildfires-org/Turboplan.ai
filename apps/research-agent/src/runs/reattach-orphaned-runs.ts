import type { ModalClient } from "modal";

import { logger } from "../infra/logger";
import type { RunManager } from "./run-manager";
import type { RunRepository } from "./run-repository";

/**
 * Reconciles runs stuck in active statuses after a server restart.
 * For runs with a live sandbox, reattaches to it via the run engine.
 * For runs with a dead sandbox or no sandboxId, marks them as failed.
 */
export const reattachOrphanedRuns = async (
  repository: RunRepository,
  runManager: RunManager,
  modalClient: ModalClient | null,
): Promise<void> => {
  if (!modalClient) return;

  try {
    const orphanedRuns = await repository.findByStatuses([
      "created",
      "running",
    ]);
    if (orphanedRuns.length === 0) return;

    logger.log(
      `Found ${orphanedRuns.length} orphaned run(s), reconciling...`,
      "server",
    );

    for (const run of orphanedRuns) {
      try {
        // If no sandboxId, mark as failed and clean up the store entry.
        if (!run.sandboxId) {
          await repository.updateStatus(run.runId, "failed", {
            errorJson: JSON.stringify({
              msg: "Server restarted during execution",
              status: 503,
            }),
          });
          logger.log(
            `Marked orphaned run ${run.runId} as failed (no sandbox ID)`,
            "server",
          );
          continue;
        }

        // Check if sandbox is still alive
        const sandbox = await modalClient.sandboxes.fromId(run.sandboxId);
        const exitCode = await sandbox.poll();

        // Sandbox already exited — mark as failed
        if (exitCode !== null) {
          await repository.updateStatus(run.runId, "failed", {
            errorJson: JSON.stringify({
              msg: `Server restarted — sandbox exited with code ${exitCode}`,
              status: 503,
            }),
          });
          logger.log(
            `Marked orphaned run ${run.runId} as failed (sandbox exited with code ${exitCode})`,
            "server",
          );
          continue;
        }

        // Sandbox still alive — reattach.
        // webhookSecret and projectId were already injected into the sandbox
        // as secrets at creation time, so they don't need to be passed again.
        runManager.adoptRun({
          runId: run.runId,
          sandboxId: run.sandboxId,
          prompt: run.prompt,
          webhookSecret: "",
          projectId: undefined,
        });
        logger.log(
          `Reattached to orphaned run ${run.runId} (sandbox ${run.sandboxId})`,
          "server",
        );
      } catch (err) {
        logger.error(`Failed to reconcile run ${run.runId}`, err, {
          runId: run.runId,
        });
        await repository
          .updateStatus(run.runId, "failed", {
            errorJson: JSON.stringify({
              msg: "Server restarted — failed to check sandbox status",
              status: 503,
            }),
          })
          .catch(() => {});
      }
    }
  } catch (err) {
    logger.error("Failed to reconcile orphaned runs", err);
  }
};
