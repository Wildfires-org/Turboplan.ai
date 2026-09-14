---
description: Code style, linting, formatting, and naming conventions
globs:
alwaysApply: true
---

# Code Conventions

## Linting and Formatting

This project uses **Biome 2.1.4** for both linting and formatting. Never use ESLint or Prettier.

Run from root:

- `pnpm format:write` – Format all files
- `pnpm lint:fix` – Fix linting issues

Biome is configured in `biome.jsonc` with: 2-space indentation, double quotes, semicolons always, trailing commas always.

## Naming Conventions

- **Files/Directories**: kebab-case (`use-artifact.ts`, `auth-wizard/`)
- **Components**: kebab-case files, PascalCase exports (`task-list.tsx` exports `TaskList`)
- **Hooks**: `use-` prefix (`use-projects.ts`)
- **Types/Interfaces**: PascalCase, prefer `type` over `interface`

## TypeScript Guidelines

- Use TypeScript for all code
- Export types from dedicated `types.ts` files
- Use functional components with typed props interfaces

## Code Style

- Prefer functional and declarative patterns, but classes are OK for reasonable scenarios
- Use descriptive variable names with auxiliary verbs (`isLoading`, `hasError`, `canSubmit`)
- Event handlers use `handle` prefix (`handleClick`, `handleSubmit`)
- Use early returns for readability

### Use `const` arrow functions instead of `function` declarations

```typescript
// Good
const getUser = (id: string) => {
  return db.query.user.findFirst({ where: eq(user.id, id) });
};

// Bad
function getUser(id: string) {
  return db.query.user.findFirst({ where: eq(user.id, id) });
}
```

### Always use curly braces and newlines for `if` statements

Never write one-liner `if` statements. The body must be on its own line inside curly braces.

```typescript
// Good
if (!user) {
  return null;
}

// Bad
if (!user) return null;
```

## Documentation

Avoid creating excessive markdown documentation files. Assume code is written for mid-level engineers. Only document concepts that are not self-explanatory from the code itself.
