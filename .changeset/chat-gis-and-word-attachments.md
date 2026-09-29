---
"turboplan": minor
"@wildfires-org/turboplan-map": minor
"@wildfires-org/turboplan-map-server": minor
---

Make GIS ZIPs and Word documents attached in a project chat work without extra steps.

- **GIS ZIPs**: attaching a ZIP in a project chat now saves its layers to the
  project map right away, with a toast "Added N GIS layers to project map".
  Layers already on the map are skipped. The map artifact no longer opens the
  "add layers" dialog; it only displays the data. New
  `processAndSaveGisZip` / `saveGisLayersToProject` helpers in
  `@wildfires-org/turboplan-map/client` do the processing and saving. The map
  artifact now also receives ZIPs sent as v6 file parts.
- **Word documents**: the model is no longer told it cannot read DOC/DOCX
  attachments in project chats. It is told the file was added to project
  documents and to read it with `readProjectDocuments`, which gains a
  `filenames` input.
- **Map server**: ZIPs may now also contain GeoPackages (every vector layer),
  GeoJSON (`.geojson`, or `.json` holding a FeatureCollection) and KML, in any
  folder. `__MACOSX/` and hidden files are ignored. Error messages now name
  the file that could not be read, list the supported formats when a ZIP has
  none, and explain a missing `.prj` file or a coordinate system that cannot
  be converted. The map proxy passes these 400/413 messages through to the
  client.
