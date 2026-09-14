import type { FastModelClientOptions } from "../infra/model-provider";
import { createFastModelClient } from "./ai-client";
import { createMemoryRepository } from "./repository";
import { createMemoryService, type MemoryService } from "./service";

export type { MemoryRecord } from "./repository";
export type { MemoryService } from "./service";

export function initMemoryService(
  fastModel: string | null,
  clientOptions: FastModelClientOptions | null = null,
): MemoryService {
  const repository = createMemoryRepository();
  const fastModelClient = fastModel
    ? createFastModelClient(fastModel, clientOptions)
    : null;
  return createMemoryService(repository, fastModelClient);
}
