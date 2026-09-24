---
"@wildfires-org/turboplan-map": patch
---

Security: map feature popups and labels no longer render uploaded GeoJSON or
shapefile property keys and values as HTML. A layer property such as
`<img src=x onerror=...>` previously executed script for every viewer of the
map, including public project pages on the landing page. Popups and tooltips are
now built from DOM nodes with `textContent`.
