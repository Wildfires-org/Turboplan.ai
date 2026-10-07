---
"turboplan": patch
"@wildfires-org/turboplan-map": patch
---

Maps no longer show a faint white grid between tiles. Leaflet's
`plus-lighter` tile blending added overlapping tile edges up to white at
fractional zoom; tiles are now drawn normally over a background that matches
each basemap, so any hairline gap stays invisible.
