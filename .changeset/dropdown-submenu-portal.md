---
"@wildfires-org/turboplan-utils": patch
---

Fix dropdown submenus (such as the document artifact's Download → PDF / Word
options) not appearing. Since the glass restyle, the parent menu's backdrop
blur and zoom animation clipped any submenu rendered inside it; submenus are
now rendered in a portal.
