import { NextResponse } from "next/server";

/**
 * Create standardized error response for API endpoints
 * @param message - Error message to display
 * @param status - HTTP status code
 * @returns NextResponse with consistent error format
 */
export function createErrorResponse(
  message: string,
  status: number,
): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Common error responses
 */
export const ErrorResponses = {
  unauthorized: () => createErrorResponse("Unauthorized", 401),
  forbidden: (message = "Access denied") => createErrorResponse(message, 403),
  notFound: (message = "Resource not found") =>
    createErrorResponse(message, 404),
  badRequest: (message = "Invalid request") =>
    createErrorResponse(message, 400),
  internalServerError: (message = "Internal server error") =>
    createErrorResponse(message, 500),
} as const;
