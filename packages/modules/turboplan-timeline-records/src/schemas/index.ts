import { z } from "zod";

import {
  HTTP_URL_ONLY_MESSAGE,
  isSafeHttpUrl,
} from "@wildfires-org/turboplan-utils/server";

import { ACTIONS, ENTITY_TYPES, VALUE_TYPES } from "../types";

export const fieldChangeSchema = z.object({
  field: z.string(),
  previousValue: z.unknown(),
  newValue: z.unknown(),
  valueType: z.enum(VALUE_TYPES),
});

export const createTimelineRecordInputSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().uuid(),
  entityName: z.string().optional(),
  action: z.enum(ACTIONS),
  changes: z.array(fieldChangeSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Query-string boolean: only the literals "true" and "false" are accepted.
 * `z.coerce.boolean()` would turn the string "false" into `true`.
 */
export const queryBooleanSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const timelineQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  entityType: z.enum(ENTITY_TYPES).optional(),
  action: z.enum(ACTIONS).optional(),
  userId: z.string().uuid().optional(),
  isPublic: queryBooleanSchema.optional(),
});

export const manualRecordSchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().uuid(),
  entityName: z.string().optional(),
  action: z.enum(ACTIONS),
  title: z.string().optional(),
  description: z.string().optional(),
  changes: z.array(fieldChangeSchema).optional(),
  resourceUrls: z
    .array(
      z.object({
        url: z.string().url().refine(isSafeHttpUrl, HTTP_URL_ONLY_MESSAGE),
        filename: z.string(),
        type: z.string().optional(),
      }),
    )
    .optional(),
  isPublic: z.boolean().optional().default(true),
  startedAt: z.coerce.date().optional(),
  endedAt: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type TimelineQueryParams = z.infer<typeof timelineQuerySchema>;
export type ManualRecordInput = z.infer<typeof manualRecordSchema>;
