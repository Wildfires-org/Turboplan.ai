---
"turboplan": minor
"@wildfires-org/turboplan-map": minor
"@wildfires-org/turboplan-map-server": minor
"@wildfires-org/turboplan-upload": minor
---

Accept GIS files that are not zipped: `.geojson`, `.kml`, `.kmz` and `.gpkg`
now work alongside `.zip` in the project chat, on the map page and through the
map service.

- **Map server**: `/api/upload` takes a ZIP/KMZ, or a single GeoJSON, KML or
  GeoPackage file. The format comes from the file content (ZIP and SQLite
  signatures, `<kml`, GeoJSON markers), not from the stored content type. The
  optional `filename` names the layers, and a KMZ's `doc.kml` layer is named
  after the KMZ. Anything else fails with "Unsupported file type…" and a list
  of what is accepted.
- **Upload allow list**: now includes KMZ, GeoPackage and `text/plain`, the
  type KML is stored under. `application/vnd.google-earth.kml+xml` stays
  refused: storage serves files inline, and browsers render `+xml` types as
  XML documents, which could run script.
- **Map package**: `processAndSaveGisZip` is renamed `processAndSaveGisFile`.
  The map artifact and the map page's drop zone, upload hook and file picker
  accept the standalone formats, capped at 100 MB (the map service limit).
- **Chat**: every GIS file dropped in a project chat is saved to the project
  map and noted for the model, as ZIPs already were. Files whose type the
  browser can't name are uploaded with the type their extension maps to.
