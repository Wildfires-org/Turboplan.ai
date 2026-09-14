"use client";

import { useMemo } from "react";

import type { PromptVersion } from "@wildfires-org/turboplan-db/types";
import {
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ScrollArea,
} from "@wildfires-org/turboplan-utils";

interface VersionDiffProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentVersion: PromptVersion;
  compareVersion: PromptVersion;
}

interface DiffLine {
  type: "unchanged" | "added" | "removed";
  content: string;
  lineNumber?: number;
}

/**
 * Simple line-by-line diff algorithm.
 */
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const diff: DiffLine[] = [];

  // Simple LCS-based diff
  const lcs = computeLCS(oldLines, newLines);
  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (
      lcsIdx < lcs.length &&
      oldLines[oldIdx] === lcs[lcsIdx] &&
      newLines[newIdx] === lcs[lcsIdx]
    ) {
      diff.push({ type: "unchanged", content: lcs[lcsIdx] });
      oldIdx++;
      newIdx++;
      lcsIdx++;
    } else if (
      oldIdx < oldLines.length &&
      (lcsIdx >= lcs.length || oldLines[oldIdx] !== lcs[lcsIdx])
    ) {
      diff.push({ type: "removed", content: oldLines[oldIdx] });
      oldIdx++;
    } else if (newIdx < newLines.length) {
      diff.push({ type: "added", content: newLines[newIdx] });
      newIdx++;
    }
  }

  return diff;
}

/**
 * Compute Longest Common Subsequence.
 */
function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

export function VersionDiff({
  open,
  onOpenChange,
  currentVersion,
  compareVersion,
}: VersionDiffProps) {
  const isSameVersion = currentVersion.version === compareVersion.version;

  const diff = useMemo(() => {
    if (isSameVersion) return [];
    return computeDiff(compareVersion.content, currentVersion.content);
  }, [currentVersion.content, compareVersion.content, isSameVersion]);

  const stats = useMemo(() => {
    const added = diff.filter((d) => d.type === "added").length;
    const removed = diff.filter((d) => d.type === "removed").length;
    return { added, removed };
  }, [diff]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Version Comparison</span>
            <div className="flex items-center gap-2 text-sm font-normal">
              <Badge variant="outline">v{compareVersion.version}</Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="default">
                v{currentVersion.version} (active)
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isSameVersion ? (
          <div className="text-center py-8 text-muted-foreground">
            This is the currently active version.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="text-green-600">+{stats.added} added</span>
              <span className="text-red-600">-{stats.removed} removed</span>
            </div>

            <ScrollArea className="h-[500px] border rounded-md">
              <div className="p-4 font-mono text-sm">
                {diff.map((line, idx) => (
                  <div
                    key={idx}
                    className={`px-2 py-0.5 ${
                      line.type === "added"
                        ? "bg-green-500/20 text-green-700 dark:text-green-400"
                        : line.type === "removed"
                          ? "bg-red-500/20 text-red-700 dark:text-red-400"
                          : ""
                    }`}
                  >
                    <span className="select-none mr-2 text-muted-foreground">
                      {line.type === "added"
                        ? "+"
                        : line.type === "removed"
                          ? "-"
                          : " "}
                    </span>
                    {line.content || " "}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
