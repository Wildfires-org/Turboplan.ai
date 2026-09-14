"use client";

import { useEffect, useState } from "react";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function useElapsedTime(
  createdAt: string | undefined,
  updatedAt: string | undefined,
  isActive: boolean,
): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isActive || !createdAt) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, createdAt]);

  if (!createdAt) return null;

  const startTime = Date.parse(createdAt);

  if (isActive) {
    return formatElapsed(now - startTime);
  }

  if (updatedAt) {
    return formatElapsed(Date.parse(updatedAt) - startTime);
  }

  return null;
}
