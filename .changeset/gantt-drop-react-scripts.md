---
"@wildfires-org/turboplan-gantt-task": patch
---

Drop the unused `react-scripts` dev dependency. It only backed the disabled
`test:unit` / `test:watch` scripts, and it pulled in webpack-dev-server, svgo,
node-forge and about 600 other packages with open security advisories. The
built package is byte-identical.
