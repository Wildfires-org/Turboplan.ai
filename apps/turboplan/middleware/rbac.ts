/**
 * RBAC Permission Middleware
 *
 * This file binds the RBAC package middleware to our NextAuth provider.
 * Without this wrapper, you'd need to pass `auth` to every route file.
 * This keeps your auth provider as a single source of truth.
 */

import type { NextRequest } from "next/server";

import type {
  ActionType,
  EntityTypeType,
  PermissionCheckResult,
} from "@wildfires-org/turboplan-rbac";
import {
  checkPermission as checkPermissionBase,
  requirePermission as requirePermissionNextJS,
} from "@wildfires-org/turboplan-rbac/nextjs";

import { auth } from "@/app/(auth)/auth";

/**
 * Check if the current user has permission to perform an action on an entity
 */
export async function checkPermission(
  entityId: string,
  entityType: EntityTypeType,
  action: ActionType,
): Promise<PermissionCheckResult> {
  return checkPermissionBase(auth, entityId, entityType, action);
}

/**
 * Next.js API route permission middleware
 *
 * @example
 * export const GET = requirePermission(
 *   EntityType.ORGANIZATION,
 *   Action.READ,
 *   (req, context) => context.params.id
 * )(async (req, user, context) => {
 *   return NextResponse.json({ data: 'ok' });
 * });
 */
export function requirePermission<TContext = unknown>(
  entityType: EntityTypeType,
  action: ActionType,
  getEntityId: (req: NextRequest, context?: TContext) => string | null,
) {
  return requirePermissionNextJS(auth, entityType, action, getEntityId);
}
