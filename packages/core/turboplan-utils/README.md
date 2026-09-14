# @wildfires-org/turboplan-utils

Shared UI components (shadcn/ui), Tailwind utilities, hooks, and helpers used across TurboPlan apps and packages.

## Exports

| Path | Contents |
| --- | --- |
| `.` | Everything: components, hooks, constants, `cn()`, email/slug/user helpers |
| `/server` | Server-safe subset (constants, slug, user helpers) — no React or client code |

## What's Inside

### UI components (`src/components`)

shadcn/ui-style components pre-configured with the project design system: `Button`, `Card`, `Dialog`, `AlertDialog`, `Input`, `Textarea`, `Select`, `Checkbox`, `DropdownMenu`, `Popover`, `Tooltip`, `Table`, `Badge`, `Avatar`, `Skeleton`, `ScrollArea`, `Accordion`, and project-specific pieces (`CommentsSection`, `ProjectImageHeader`, `ProjectProgress`, `SuggestionPills`, `TemplateCard`, `JsonBlock`, ...). Toast helpers are built on `sonner`.

```tsx
import { Button, Card, toast } from "@wildfires-org/turboplan-utils";
```

### Tailwind (`cn`)

```tsx
import { cn } from "@wildfires-org/turboplan-utils";

<div className={cn("flex items-center", isActive && "bg-primary")} />
```

### Hooks

- `useCustomEventListener` / `useCustomEventTrigger` (+ `AppEvent`) – typed cross-component custom events
- `useMediaQuery`

For other utility hooks, prefer the `usehooks-ts` library.

### Constants

- HTTP header names (`src/constants/headers.ts`)
- z-index scale (`src/constants/z-index.ts`)

### Helpers

- `src/email.ts` – email helpers
- `src/slug.ts` – slug generation (unit-tested in `tests/`)
- `src/user.ts` – user display helpers

## Usage in server code

Import from `/server` to avoid pulling React into server bundles:

```typescript
import { generateSlug } from "@wildfires-org/turboplan-utils/server";
```

## Development

```bash
pnpm build      # tsdown
pnpm test       # Node test runner
pnpm typecheck
```
