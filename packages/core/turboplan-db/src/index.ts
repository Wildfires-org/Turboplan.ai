// Main exports - Drizzle schemas (table definitions)
// This export includes drizzle-orm imports and should be used in SERVER-ONLY code.
//
// For CLIENT components:
// - Import types from '@wildfires-org/turboplan-db/types' (pure TypeScript types, no Drizzle)
// - Import utilities from '@wildfires-org/turboplan-db/utils' (client-safe helper functions)
//
// For SERVER components:
// - Import schemas from here or '@wildfires-org/turboplan-db/schemas' (Drizzle table definitions)
// - Import queries from '@wildfires-org/turboplan-db/queries' (database query functions)
// - Import db client from '@wildfires-org/turboplan-db/db-client' (database connection)
//
export * from "./schemas";
