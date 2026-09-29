---
"@wildfires-org/turboplan-workspace": patch
---

Respect module privacy when cloning public templates and serving public
documents. Cloning a public template copied every module's content, so anyone
could read fields, tasks and documents the template owner had marked hidden or
private; callers without read access to the template now get a copy without
those modules. Public project and template document lists now return only
uploaded documents, and research documents are gated on the `context` module
instead of `documents` for public-government readers.
