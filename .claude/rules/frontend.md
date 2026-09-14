---
description: React component patterns, Server vs Client components
globs:
  - "**/*.tsx"
alwaysApply: false
---

# React Components

## Server vs Client Components

Default to Server Components. Use Client Components only when needed for:

- Interactive UI (onClick, onChange, form state)
- Browser APIs (localStorage, window)
- React hooks (useState, useEffect, useSWR)
- Third-party client libraries

Add `"use client"` directive at the top of client component files.

## Avoid Server Actions

Do not create new server actions (`"use server"`). Instead, create Hono endpoints and call them from client components using SWR or the API client.

## Component Structure

Organize component files in this order:

1. `"use client"` directive (if needed)
2. Imports (Biome auto-organizes)
3. Types/Interfaces
4. Constants
5. Helper functions
6. Main exported component
7. Sub-components (if any)

## Props Pattern

Define props interface directly above the component:

```typescript
interface ProjectCardProps {
  project: Project;
  onEdit?: () => void;
}

export function ProjectCard({ project, onEdit }: ProjectCardProps) {
  // ...
}
```

## UI Components

Use shadcn/ui components from `@wildfires-org/turboplan-utils`. These are pre-configured with the project's design system.

## Forms

Use React Hook Form with Zod validation. See `apps/turboplan/components/dashboard/` for form patterns.

## React hooks

For utility hooks we use usehooks-ts library. Before creating your own custom utility hook, think of using a library.
