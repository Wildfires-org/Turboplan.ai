/**
 * Example Next.js API routes using entity-based RBAC
 *
 * Prerequisites:
 * 1. RBAC service must be initialized with database connection (in your app startup)
 * 2. Create a wrapper function that binds your auth provider to the middleware
 *
 * Setup in your app:
 *
 * // lib/auth/rbac-helpers.ts
 * import { auth } from '@/app/(auth)/auth';
 * import { requirePermission as requirePermissionNextJS } from '@wildfires-org/turboplan-rbac';
 *
 * export function requirePermission(entityType, action, getEntityId) {
 *   return requirePermissionNextJS(auth, entityType, action, getEntityId);
 * }
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { Action, EntityType } from "../src/index";
import {
  AuthenticatedUser,
  checkPermission,
  requirePermission,
} from "../src/nextjs";

// Route context type for Next.js dynamic routes
interface RouteParams {
  orgId?: string;
  projectId?: string;
  documentId?: string;
  officeId?: string;
}

interface RouteContext {
  params: RouteParams;
}

// Mock auth provider for examples
// In production, use NextAuth or your custom auth
const mockAuth = async () => {
  return {
    user: {
      id: "123e4567-e89b-12d3-a456-426614174000",
      email: "user@example.com",
      name: "John Doe",
    },
  };
};

// ============================================================================
// ORGANIZATION ROUTES
// ============================================================================

/**
 * GET /api/organizations/:orgId
 * Read organization (viewer, editor, owner can access)
 */
export const getOrganization = requirePermission<RouteContext>(
  mockAuth,
  EntityType.ORGANIZATION,
  Action.READ,
  (_req, context) => context?.params?.orgId || null,
)(async (_req: NextRequest, user: AuthenticatedUser, context: unknown) => {
  const { params } = context as RouteContext;
  const orgId = params.orgId;

  return NextResponse.json({
    message: "Organization data",
    orgId,
    userId: user.id,
  });
});

/**
 * PUT /api/organizations/:orgId
 * Update organization (editor or owner can access)
 */
export const updateOrganization = requirePermission<RouteContext>(
  mockAuth,
  EntityType.ORGANIZATION,
  Action.UPDATE,
  (_req, context) => context?.params?.orgId || null,
)(async (req: NextRequest, _user: AuthenticatedUser, _context: unknown) => {
  const body = await req.json();

  return NextResponse.json({
    message: "Organization updated",
    data: body,
  });
});

/**
 * DELETE /api/organizations/:orgId
 * Delete organization (owner only)
 */
export const deleteOrganization = requirePermission<RouteContext>(
  mockAuth,
  EntityType.ORGANIZATION,
  Action.DELETE,
  (_req, context) => context?.params?.orgId || null,
)(async (_req: NextRequest, _user: AuthenticatedUser, context: unknown) => {
  const { params } = context as RouteContext;
  const orgId = params.orgId;

  return NextResponse.json({
    message: `Organization ${orgId} deleted`,
  });
});

/**
 * POST /api/organizations/:orgId/members
 * Manage members (owner only)
 */
export const addOrganizationMember = requirePermission<RouteContext>(
  mockAuth,
  EntityType.ORGANIZATION,
  Action.MANAGE_MEMBERS,
  (_req, context) => context?.params?.orgId || null,
)(async (req: NextRequest, _user: AuthenticatedUser, _context: unknown) => {
  const body = await req.json();

  return NextResponse.json({
    message: "Member added to organization",
    data: body,
  });
});

// ============================================================================
// OFFICE ROUTES
// ============================================================================

/**
 * GET /api/offices/:officeId
 * Read office (with permission inheritance from organization)
 */
export const getOffice = requirePermission<RouteContext>(
  mockAuth,
  EntityType.OFFICE,
  Action.READ,
  (_req, context) => context?.params?.officeId || null,
)(async (_req: NextRequest, _user: AuthenticatedUser, context: unknown) => {
  const { params } = context as RouteContext;
  const officeId = params.officeId;

  return NextResponse.json({
    message: "Office data",
    officeId,
  });
});

/**
 * PUT /api/offices/:officeId
 * Update office
 */
export const updateOffice = requirePermission<RouteContext>(
  mockAuth,
  EntityType.OFFICE,
  Action.UPDATE,
  (_req, context) => context?.params?.officeId || null,
)(async (req: NextRequest, _user: AuthenticatedUser, _context: unknown) => {
  const body = await req.json();

  return NextResponse.json({
    message: "Office updated",
    data: body,
  });
});

// ============================================================================
// PROJECT ROUTES
// ============================================================================

/**
 * GET /api/projects/:projectId
 * Read project (with permission inheritance from office/organization)
 */
export const getProject = requirePermission<RouteContext>(
  mockAuth,
  EntityType.PROJECT,
  Action.READ,
  (_req, context) => context?.params?.projectId || null,
)(async (_req: NextRequest, _user: AuthenticatedUser, context: unknown) => {
  const { params } = context as RouteContext;
  const projectId = params.projectId;

  return NextResponse.json({
    message: "Project data",
    projectId,
  });
});

/**
 * PUT /api/projects/:projectId
 * Update project
 */
export const updateProject = requirePermission<RouteContext>(
  mockAuth,
  EntityType.PROJECT,
  Action.UPDATE,
  (_req, context) => context?.params?.projectId || null,
)(async (req: NextRequest, _user: AuthenticatedUser, _context: unknown) => {
  const body = await req.json();

  return NextResponse.json({
    message: "Project updated",
    data: body,
  });
});

/**
 * DELETE /api/projects/:projectId
 * Delete project (owner only)
 */
export const deleteProject = requirePermission<RouteContext>(
  mockAuth,
  EntityType.PROJECT,
  Action.DELETE,
  (_req, context) => context?.params?.projectId || null,
)(async (_req: NextRequest, _user: AuthenticatedUser, context: unknown) => {
  const { params } = context as RouteContext;
  const projectId = params.projectId;

  return NextResponse.json({
    message: `Project ${projectId} deleted`,
  });
});

// ============================================================================
// ADVANCED EXAMPLES
// ============================================================================

/**
 * GET /api/reports?orgId=xxx
 * Extract entity ID from query parameter
 */
export const getReports = requirePermission(
  mockAuth,
  EntityType.ORGANIZATION,
  Action.READ,
  (req) => req.nextUrl.searchParams.get("orgId"),
)(async (req: NextRequest, user: AuthenticatedUser) => {
  return NextResponse.json({
    message: "Reports data",
  });
});

/**
 * POST /api/actions?projectId=xxx
 * Extract entity ID from query string for POST requests
 */
export const performAction = requirePermission(
  mockAuth,
  EntityType.PROJECT,
  Action.UPDATE,
  (req) => req.nextUrl.searchParams.get("projectId"),
)(async (req: NextRequest, user: AuthenticatedUser) => {
  const body = await req.json();

  return NextResponse.json({
    message: "Action performed",
    data: body,
  });
});

// ============================================================================
// DIRECT PERMISSION CHECK (without middleware)
// ============================================================================

/**
 * Example of checking permissions directly in your handler
 * Useful for complex logic where you need conditional permission checks
 */
export async function complexOperation(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  const projectId = req.nextUrl.searchParams.get("projectId");

  if (!orgId || !projectId) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  // Check multiple permissions
  const canReadOrg = await checkPermission(
    mockAuth,
    orgId,
    EntityType.ORGANIZATION,
    Action.READ,
  );

  const canUpdateProject = await checkPermission(
    mockAuth,
    projectId,
    EntityType.PROJECT,
    Action.UPDATE,
  );

  if (!canReadOrg.allowed || !canUpdateProject.allowed) {
    return NextResponse.json(
      {
        error: "Insufficient permissions",
        reasons: {
          organization: canReadOrg.reason,
          project: canUpdateProject.reason,
        },
      },
      { status: 403 },
    );
  }

  // Proceed with operation
  return NextResponse.json({
    message: "Complex operation completed",
    effectiveRoles: {
      organization: canReadOrg.effectiveRole,
      project: canUpdateProject.effectiveRole,
    },
  });
}

// ============================================================================
// ACTUAL ROUTE FILE EXAMPLE
// ============================================================================

/**
 * Example of a complete Next.js App Router route file:
 *
 * // app/api/organizations/[orgId]/route.ts
 * import { requirePermission } from '@/lib/auth/rbac-helpers';
 * import { EntityType, Action } from '@wildfires-org/turboplan-rbac';
 *
 * export const GET = requirePermission(
 *   EntityType.ORGANIZATION,
 *   Action.READ,
 *   (req, context) => context.params.orgId
 * )(async (req, user, context) => {
 *   const orgId = context.params.orgId;
 *
 *   // Your logic here
 *   const organization = await db.query.organizations.findFirst({
 *     where: eq(organizations.id, orgId),
 *   });
 *
 *   return NextResponse.json({ organization });
 * });
 *
 * export const PUT = requirePermission(
 *   EntityType.ORGANIZATION,
 *   Action.UPDATE,
 *   (req, context) => context.params.orgId
 * )(async (req, user, context) => {
 *   const orgId = context.params.orgId;
 *   const body = await req.json();
 *
 *   // Your logic here
 *   await db.update(organizations)
 *     .set(body)
 *     .where(eq(organizations.id, orgId));
 *
 *   return NextResponse.json({ success: true });
 * });
 */
