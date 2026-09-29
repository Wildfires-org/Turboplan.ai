---
"@wildfires-org/turboplan-research-agent-integration": patch
---

Harden the research agent against leaked run credentials. A bootstrapper run's
webhook secret stayed valid forever, so anyone who obtained it (the agent's
shell can read it) could keep posting suggestions to the project and flip a
finished run back to "running"; the secret is now rejected once the run is
completed, failed or cancelled, and terminal runs can no longer be revived by a
progress update (this also fixes a race where the agent's final "done" webhook
reset completed runs to running). The research-agent service's callback client
no longer follows redirects, so the webhook secret cannot be re-sent to an
unchecked host, and the local runner passes the agent an explicit environment
allowlist instead of the whole server environment.
