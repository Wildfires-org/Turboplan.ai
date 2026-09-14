import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getRBACService } from "../services/rbac.service";
import type {
  ActionType,
  EntityTypeType,
  PermissionCheckResult,
} from "../types";

/**
 * User session interface for Next.js middleware
 * Your auth provider should return this shape (compatible with NextAuth Session)
 */
export interface UserSession {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
  };
}

/**
 * Authenticated user passed to route handlers
 */
export interface AuthenticatedUser {
  id: string;
  email?: string;
  name?: string;
}

/**
 * Session provider function - implement this with your auth strategy
 * Accepts any function that returns a Promise with user session or null
 *
 * @example
 * // NextAuth example
 * const getSession = () => auth();
 *
 * // Custom JWT example
 * const getSession = async () => {
 *   const token = cookies().get('auth-token');
 *   return validateToken(token);
 * };
 */
export type SessionProvider = (
  ...args: unknown[]
) => Promise<UserSession | null>;

/**
 * Check if the current user has permission to perform an action on an entity
 *
 * @param getSession - Function that returns the current user session
 * @param entityId - ID of the entity to check permission for
 * @param entityType - Type of entity (organization, office, project)
 * @param action - Action to perform (create, read, update, delete, manage_members)
 * @returns Permission check result
 *
 * @example
 * import { auth } from '@/app/(auth)/auth';
 * import { checkPermission } from '@wildfires-org/turboplan-rbac';
 *
 * const result = await checkPermission(
 *   auth,
 *   orgId,
 *   'organization',
 *   'read'
 * );
 *
 * if (!result.allowed) {
 *   return new Response('Forbidden', { status: 403 });
 * }
 */
export async function checkPermission(
  getSession: SessionProvider,
  entityId: string,
  entityType: EntityTypeType,
  action: ActionType,
): Promise<PermissionCheckResult> {
  const session = await getSession();

  if (!session?.user?.id) {
    return {
      allowed: false,
      reason: "User not authenticated",
    };
  }

  const rbacService = getRBACService();
  return rbacService.checkPermission(
    session.user.id,
    entityId,
    entityType,
    action,
  );
}

/**
 * Next.js middleware to check entity-based permissions for API routes
 *
 * @param getSession - Function that returns the current user session
 * @param entityType - Type of entity (organization, office, project)
 * @param action - Action to perform (create, read, update, delete, manage_members)
 * @param getEntityId - Function to extract entity ID from request
 * @returns Middleware that wraps your route handler
 *
 * @example
 * import { auth } from '@/app/(auth)/auth';
 * import { requirePermission, EntityType, Action } from '@wildfires-org/turboplan-rbac';
 *
 * export const GET = requirePermission(
 *   auth,
 *   EntityType.ORGANIZATION,
 *   Action.READ,
 *   (req) => req.nextUrl.searchParams.get('orgId')
 * )(async (req, user) => {
 *   // User has read permission for this organization
 *   return NextResponse.json({ data: 'organization data' });
 * });
 *
 * // With URL params (using context)
 * export const GET = requirePermission(
 *   auth,
 *   EntityType.ORGANIZATION,
 *   Action.READ,
 *   (req, context) => context.params.orgId
 * )(async (req, user) => {
 *   return NextResponse.json({ data: 'organization data' });
 * });
 */
export function requirePermission<TContext = unknown>(
  getSession: SessionProvider,
  entityType: EntityTypeType,
  action: ActionType,
  getEntityId: (req: NextRequest, context?: TContext) => string | null,
) {
  return (
    handler: (
      req: NextRequest,
      user: AuthenticatedUser,
      context?: TContext,
    ) => Promise<NextResponse> | NextResponse,
  ) => {
    return async (
      req: NextRequest,
      context?: TContext,
    ): Promise<NextResponse> => {
      const session = await getSession();

      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 },
        ) as NextResponse;
      }

      const entityId = getEntityId(req, context);
      if (!entityId) {
        return NextResponse.json(
          { error: "Entity ID not found" },
          { status: 400 },
        ) as NextResponse;
      }

      const rbacService = getRBACService();
      const permissionResult = await rbacService.checkPermission(
        session.user.id,
        entityId,
        entityType,
        action,
      );

      if (!permissionResult.allowed) {
        return NextResponse.json(
          { error: "Forbidden", reason: permissionResult.reason },
          { status: 403 },
        ) as NextResponse;
      }

      // Call the handler with the authenticated user
      return handler(
        req,
        {
          id: session.user.id,
          email: session.user.email || undefined,
          name: session.user.name || undefined,
        },
        context,
      );
    };
  };
}

/**
 * React hook interface for permission checks in components
 * This is a type definition - implement the actual hook in your app
 *
 * @example
 * // Implementation example in your app:
 * import { useQuery } from '@tanstack/react-query';
 * import type { UsePermissionOptions, UsePermissionResult } from '@wildfires-org/turboplan-rbac';
 *
 * export function usePermission(options: UsePermissionOptions): UsePermissionResult {
 *   return useQuery({
 *     queryKey: ['permission', options.entityId, options.entityType, options.action],
 *     queryFn: async () => {
 *       const response = await fetch('/api/check-permission', {
 *         method: 'POST',
 *         body: JSON.stringify(options),
 *       });
 *       return response.json();
 *     },
 *   });
 * }
 */
export interface UsePermissionOptions {
  entityId: string;
  entityType: EntityTypeType;
  action: ActionType;
}

export interface UsePermissionResult {
  loading: boolean;
  allowed: boolean;
  reason?: string;
  effectiveRole?: string;
}

export type UsePermission = (
  options: UsePermissionOptions,
) => UsePermissionResult;
