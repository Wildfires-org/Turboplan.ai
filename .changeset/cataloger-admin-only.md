---
"@wildfires-org/turboplan-research-agent-integration": major
---

Restrict the research-agent cataloger to platform admins. Any signed-in user
could previously start a cataloger run, which reused any organization matching a
name (making the caller owner of a new office inside someone else's org) or
minted a new GOVERNMENT organization owned by the caller.

**Breaking — API routes moved:** `POST /api/ai/research-agent/cataloger/run`
and `GET /api/ai/research-agent/cataloger/run/:runId` are now
`POST /api/admin/cataloger/run` and `GET /api/admin/cataloger/run/:runId`
(admin only); the per-user `GET /api/ai/research-agent/cataloger/runs` is
removed in favour of the existing admin `GET /api/admin/cataloger/runs`. The
landing page "Request for Catalog" dialog now calls the admin route, so it only
works for admins. The cataloger webhook routes are unchanged.

Catalog runs now only reuse organizations and offices the running admin owns,
cap the prompt at 10,000 characters, and fetch catalogued documents through the
SSRF-guarded fetcher with a PDF/DOC/DOCX allowlist and sanitised storage keys.
