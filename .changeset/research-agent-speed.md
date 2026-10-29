---
"@wildfires-org/research-agent": minor
---

Make project-bootstrapper research runs finish faster (target under five
minutes) without dropping any saved components. The bootstrapper skill now
works to an explicit budget: parallel tool calls in one turn, progress and data
POSTs batched into one Bash call, at most two reference projects, about fifteen
documents (only core-document Box subfolders are scraped fresh; memory file IDs
cover the rest), about twelve milestones with up to five tasks each, short
context items, no re-fetching of citations a memory already verified, and each
component POSTed as soon as it is ready rather than all at the end. The API
schemas it needs are inlined, so it no longer reads the 900-line spec.

The sandbox now preloads the requested skill's instructions into the system
prompt, which removes the mandatory `Skill` first turn; `EnterPlanMode` and
`ToolSearch` are no longer available, and the turn cap is 50 as a safety net.
Agent logs show elapsed time and model latency on every turn and the duration of
every tool call, with per-tool totals at the end. `num_turns`, `duration_ms` and
`total_cost_usd` are stored in the run's `result_json` (as `{ result, stats }`)
or `error_json`. A run
that stops on an SDK error (for example the turn cap) now reports that error
instead of "No result line found". The start prompt limit is raised from 10,000
to 20,000 characters.
