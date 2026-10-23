---
"@wildfires-org/turboplan-map-server": patch
---

Map server: `certifi` 2026.7.22 → 2026.10.19, which removes the emSign root
CAs whose intermediate keys were compromised (GHSA-6q48-6c7w-9gw2), and
`python-dotenv` 1.1.1 → 1.2.4 (GHSA-mf9w-mj56-hr94). Dev tooling: `pytest`
7.4 → 9.1 and `black` 23 → 26.10.1.
