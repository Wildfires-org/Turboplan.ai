---
"turboplan": minor
"@wildfires-org/turboplan-utils": minor
"@wildfires-org/turboplan-workspace": patch
---

Bring the landing page's glass style to the web app, starting with the office
and organization pages.

- Office page: mint ground, banner inside a glass header card, green gradient
  primary buttons, segmented glass tabs, inset search, glass filter chips and
  glass project cards. Loading states render the real page chrome immediately
  and use placeholders sized like the real cards, so nothing shifts on load.
- Shared primitives in `@wildfires-org/turboplan-utils` (Dialog, AlertDialog,
  Input, Textarea, Select, DropdownMenu, Popover) now use the glass look app-wide:
  light blurred overlay, glass surfaces, borderless inset fields. `Button` gains
  `brand` and `glass` variants.
- The sidebar's active item and org badge use a darker green for readable
  contrast.
- New default cover banner (mountain lake photo) replaces the old collage.
