---
"@wildfires-org/turboplan-gantt-task": patch
"@wildfires-org/research-agent": patch
---

Move dev tooling with open security advisories to fixed releases: turbo 2.11,
vitest 4 for the research agent, Vite 6 for the gantt package build and
webpack 5.112. The gantt build keeps writing `dist/style.css`, and the built
code is equivalent.
