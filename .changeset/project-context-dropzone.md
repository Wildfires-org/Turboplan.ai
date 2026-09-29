---
"turboplan": minor
"@wildfires-org/turboplan-upload": patch
"@wildfires-org/turboplan-documents": patch
"@wildfires-org/turboplan-workspace": patch
---

The project Context page is now one place to add project context by dropping
files. Editors get a large drop area (or "Browse files") that takes several
files at once: PDF and Word documents are added to the project documents and
have their text extracted for the assistant, and zipped GIS layers (shapefile
or file geodatabase) go straight onto the project map. Each file gets its own
row with its status (uploading, reading layers, extracting text, added, or the
reason it failed, such as an unsupported type or a ZIP with no GIS data).

Below the drop area the page lists the project's documents, with their text
extraction status, and its map layers with feature counts; owners can remove
layers there. "Add context" and editing or deleting notes are now only offered
to users who can edit the project.

The accepted document types and size limit now come from one shared definition
used by every upload surface and by the server check.
