---
---

CI: scope the Cloudflare API token and account id to the workflow steps that
deploy or clean up workers, instead of exposing them to every job (including
dependency installs and builds of pull-request code).
