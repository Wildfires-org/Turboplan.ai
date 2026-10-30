---
"@wildfires-org/research-agent": minor
---

The research agent now deploys automatically from `main`. A push that changes `apps/research-agent/` or a package its Dockerfile copies deploys the Fly app after the database migration; a push that changes the sandbox runtime (`src/agent-runtime/`, `workspace/.claude/`) first uploads it to the Modal volume. The job needs, in the GitHub `production` environment, the secrets `FLY_API_TOKEN`, `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` and the variable `RESEARCH_AGENT_FLY_APP`, and fails naming any that are missing. The Fly app now has a `/health` check: a deploy only succeeds once it passes (a failed one is not rolled back), and a machine that cannot reach its database is taken out of routing until it can.
