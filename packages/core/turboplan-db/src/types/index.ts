/**
 * Client-safe type exports from turboplan-db
 *
 * This module exports pure TypeScript types and constants that can be safely
 * imported in client components without pulling in any server-side code.
 *
 * IMPORTANT: Do NOT add any imports from drizzle-orm, postgres, or any server-only packages here.
 * All types should be standalone definitions, not derived from Drizzle schemas.
 */

// Core types
export * from "./core";
// Project module identifiers (canonical list + labels)
export * from "./project-modules";
// Workspace types
export * from "./workspace";
