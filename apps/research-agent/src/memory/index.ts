import type { FastModelClient } from "../infra/fast-model-client";
import { createMemoryRepository } from "./repository";
import { createMemoryService, type MemoryService } from "./service";

export type { MemoryRecord } from "./repository";
export type { MemoryService } from "./service";

/** `fastModelClient` is null when no fast model is configured. */
export const initMemoryService = (
  fastModelClient: FastModelClient | null,
): MemoryService => {
  return createMemoryService(createMemoryRepository(), fastModelClient);
};
