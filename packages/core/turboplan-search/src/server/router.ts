// ============================================================================
// SEARCH ROUTER
// ============================================================================
// Hono router for the search API endpoint.
// Provides full-text search across organizations, offices, and projects.
// ============================================================================

import { Hono } from "hono";
import { z } from "zod";

import type { SearchErrorResponse, SearchResponse } from "../types";
import {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  MIN_QUERY_LENGTH,
} from "../types";
import { searchEntities } from "./queries";

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

/**
 * Query parameter validation schema for search requests
 */
// Cap query length: unbounded input feeds the trigram/ILIKE scan and is a
// cheap DoS amplifier. 200 chars is well beyond any real search.
const MAX_QUERY_LENGTH = 200;

const searchQuerySchema = z.object({
  q: z
    .string()
    .min(
      MIN_QUERY_LENGTH,
      `Query must be at least ${MIN_QUERY_LENGTH} characters`,
    )
    .max(
      MAX_QUERY_LENGTH,
      `Query must be at most ${MAX_QUERY_LENGTH} characters`,
    ),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return DEFAULT_SEARCH_LIMIT;
      const num = Number.parseInt(val, 10);
      if (Number.isNaN(num) || num < 1) return DEFAULT_SEARCH_LIMIT;
      return Math.min(num, MAX_SEARCH_LIMIT);
    }),
});

// ============================================================================
// SEARCH ROUTER
// ============================================================================

/**
 * Search router
 * Provides endpoint for full-text search across entities
 *
 * @endpoint GET / - Search organizations, offices, and projects
 */
export const searchRouter = new Hono();

/**
 * GET /
 * Search across all entities (organizations, offices, projects)
 *
 * Query Parameters:
 * - q: Search query string (required, min 2 characters)
 * - limit: Maximum number of results (optional, default 10, max 50)
 *
 * Response: { results: SearchResult[], query: string, totalCount: number }
 * Error Response: { error: string, code: string }
 *
 * Note: This is a public endpoint - no authentication required
 */
searchRouter.get("/", async (c) => {
  try {
    // Parse and validate query parameters
    const rawQuery = c.req.query("q");
    const rawLimit = c.req.query("limit");

    // Validate required query parameter
    if (!rawQuery) {
      const errorResponse: SearchErrorResponse = {
        error: "Query parameter 'q' is required",
        code: "INVALID_QUERY",
      };
      return c.json(errorResponse, 400);
    }

    // Validate query parameters with Zod
    const validationResult = searchQuerySchema.safeParse({
      q: rawQuery,
      limit: rawLimit,
    });

    if (!validationResult.success) {
      const errorMessage =
        validationResult.error.issues[0]?.message || "Invalid query parameters";
      const errorResponse: SearchErrorResponse = {
        error: errorMessage,
        code:
          rawQuery.length < MIN_QUERY_LENGTH
            ? "QUERY_TOO_SHORT"
            : "INVALID_QUERY",
      };
      return c.json(errorResponse, 400);
    }

    const { q: query, limit } = validationResult.data;

    // Execute search
    const results = await searchEntities({ query, limit });

    // Return response
    const response: SearchResponse = {
      results,
      query,
      totalCount: results.length,
    };

    return c.json(response);
  } catch (error) {
    console.error("Search error:", error);

    const errorResponse: SearchErrorResponse = {
      error: "An error occurred while searching",
      code: "INTERNAL_ERROR",
    };
    return c.json(errorResponse, 500);
  }
});
