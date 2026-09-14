# Common Agent Instructions

## ⚠️ SKILL ROUTING — MANDATORY FIRST STEP ⚠️

**Before doing ANY work, you MUST check if the user's request matches an available skill and invoke it using the `Skill` tool.**

| Request pattern                                                               | Skill to invoke                 |
| ----------------------------------------------------------------------------- | ------------------------------- |
| "Bootstrap project…", "Create project…", project descriptions, named projects | `Skill("project-bootstrapper")` |
| "Research…", "Find…", "Catalog…", template/category research                  | `Skill("project-cataloger")`    |

**Rules:**

1. Your **FIRST action** must be calling `Skill` with the matching skill name — do NOT research, fetch, or search first
2. Pass the user's full request as the argument: `Skill("project-bootstrapper", "NPS Bear Lake Trail Repair")`
3. If no skill matches, proceed normally with available tools
4. **NEVER** do manually what a skill is designed to do — the skill contains specialized workflows, verification gates, and output formats that you must follow

## ⚠️ NO CLARIFYING QUESTIONS POLICY ⚠️

**Asking the user clarifying/follow-up questions is strictly forbidden.**

If information is missing or ambiguous:

1. Make reasonable assumptions and continue
2. State assumptions briefly in the output
3. Deliver a final actionable result in the same response

Forbidden examples:

- "Could you clarify...?"
- "Please provide..."
- "Which option do you prefer?"
- Any other question directed to the user

## ⚠️ ZERO HALLUCINATION POLICY ⚠️

**Every piece of project-specific data MUST be verified via `WebFetch` before being included in any output.**

### What is "Core Data"?

Core data = any claim about a specific project's or category's reality:

| Core Data Type               | Example                                     | Verification Required                                                  |
| ---------------------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| **Project existence**        | "The Peterson Fuel Break project exists"    | `WebFetch` to USFS/BLM/NPS project page                               |
| **Document URLs**            | "Decision Memo at https://..."              | `WebFetch` to retrieve/confirm document exists                        |
| **Category citations**       | "36 CFR 220.6(e)(6) covers hazardous fuels" | `WebFetch` to the CFR/statute source and verify content matches claim |
| **Project timelines**        | "Scoping began March 2024"                  | `WebFetch` to project timeline or Federal Register                    |
| **Project-specific details** | "2,500 acres in Tahoe NF"                   | `WebFetch` to project page showing these details                      |

### Mandatory Source Verification Rules

1. **`WebFetch` BEFORE writing any core data** — you must fetch the source page and extract the information from the fetched content
2. **Extract from fetched content** — do not use training data to fill in project details; use what the fetched page actually says
3. **Cite to specific URL** — every core data claim must link back to the URL you fetched it from

## Mandatory Web Research Protocol

### When `WebFetch` is REQUIRED

| Data Type                | Required Action                                                        |
| ------------------------ | ---------------------------------------------------------------------- |
| Project existence        | `WebFetch` to the project's official page (USFS, BLM, NPS, etc.)      |
| Document URLs            | `WebFetch` to retrieve/confirm the document exists and is accessible  |
| Project timelines        | `WebFetch` to the project page or Federal Register notice             |
| Legal authority          | `WebFetch` to the CFR/statute source and verify content matches claim |
| Project-specific details | `WebFetch` to the page containing those details                       |

### Research Depth: Smart Search

**Research until you find valuable, actionable information — then STOP and proceed to writing.**

**Before writing outputs, confirm:**

- [ ] Can cite a fetched URL for each core data claim included in output
- [ ] Explicitly declared project/category existence status (found / not found)

**If you have good data → proceed to writing immediately.**

### Approved Domains

The domains below are US examples. For other jurisdictions, prefer the responsible authority's own project registry / environmental-assessment portal and the national environmental register; apply the same fetch→verify→cite discipline to whatever the authoritative source is.

You may fetch from any domain, with priority given to authoritative sources:

- `*.gov` — Federal/state government (USFS, BLM, NPS, EPA, etc.)
- `*.usda.gov` — USDA Forest Service project pages
- `*.fs2c.usda.gov` — CARA reading rooms
- `*.app.box.com` — USFS public document repositories
- `*.edu` — Educational institutions
- `*.org` — Non-profit organizations
- `*.ecfr.gov` — Electronic Code of Federal Regulations (canonical CFR source for most sections)
- `*.law.cornell.edu` — Cornell Law CFR (fallback when eCFR lacks a section; required for 36 CFR 220.6, which eCFR removed)

### `WebFetch` Best Practices

```
# GOOD: Fetch first, then extract data from the response
firecrawl_scrape("https://www.fs.usda.gov/r05/tahoe/projects/61991")
→ Extract project details from the rendered content
→ Use ONLY what the page actually says

# GOOD: Fetch legal source, then verify content matches claim
# (36 CFR 220.6 was removed from eCFR — use Cornell Law, not ecfr.gov)
WebFetch("https://www.law.cornell.edu/cfr/text/36/220.6")
→ Read the fetched content and confirm it mentions "220.6", "e", "6" and the claimed authority

# BAD: Skip fetch and use training data
→ "The project is authorized under 36 CFR 220.6(e)(6)"  ← UNVERIFIED
→ "Decision Memo at https://usfs-public.app.box.com/..."  ← FABRICATED
```

### Web Research Tools — Routing & Escalation

Use the cheapest tool that returns correct data, and escalate on failure. **Never retry the same tool on the same URL** — escalate to the next tool instead.

| Job                                          | Tool                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Discovery search (find project/analog pages) | `WebSearch` — your primary discovery tool; returns authoritative `.gov`/news results            |
| Fetch a normal page                          | `WebFetch`                                                                                      |
| Fetch a Box/gov/bot-protected or 403 page    | `firecrawl_scrape` — renders JavaScript, bypasses the bot protection that blocks `WebFetch`     |

Do **not** use `firecrawl_search` for discovery — it returns low-quality keyword matches for these queries (e.g. unrelated books/EISs, or empty results). `WebSearch` finds the right projects. Firecrawl's only job here is `firecrawl_scrape` for rendering Box/gov pages.

**Escalation rule (eliminates wasted retries):**

```
WebFetch(url)
  ├─ 200 + real content → use it
  └─ 403 / block / empty / placeholder HTML
        → firecrawl_scrape(url)   ← ONE hop; do NOT retry WebFetch on the same URL
              ├─ ok   → use it
              └─ fail → log and move on
```

**Known-blocked domains — skip `WebFetch`, go straight to `firecrawl_scrape`:** `*.app.box.com`, `*.fs.usda.gov`, `*.usda.gov`. These use Azure Front Door bot protection or JS-rendered Box widgets; trying `WebFetch` first only wastes a turn.

**USFS project page — URL form.** Get the project ID (and usually the page link) from `WebSearch`; its result links already point at the real page. A real page is `https://www.fs.usda.gov/r05/{forest}/projects/{PROJECT_ID}` (active) or `…/projects/archive/{PROJECT_ID}` (archived) — **both resolve to the real page**, so use whichever you have. The **only** broken form is `https://www.fs.usda.gov/project/{forest}/?project={ID}` (singular `project`, query param): it redirects to the bare `/projects` listing with no ID and renders useless boilerplate — never construct or scrape that one. Always fetch these with `firecrawl_scrape`, not `WebFetch`: `fs.usda.gov` is US-geo-blocked and bot-protected, but `firecrawl_scrape` fetches from Firecrawl's own servers and gets through.

### Box.com Documents — Canonical URL Rule

USFS hosts documents in Box.com. Box pages are JavaScript-rendered, so scrape the folder with `firecrawl_scrape`, then construct the **download** URL.

```
# 1. Scrape the folder to list files and read the vanity name + file IDs:
firecrawl_scrape("https://usfs-public.app.box.com/v/{VANITY_NAME}/folder/{FOLDER_ID}")

# 2. The document URL you submit MUST be the download form:
https://usfs-public.app.box.com/index.php?rm=box_download_shared_file&vanity_name={VANITY_NAME}&file_id=f_{FILE_ID}
```

- **FORBIDDEN as a document `url`:** the viewer pages `/v/{VANITY_NAME}/file/{FILE_ID}` and `/v/{VANITY_NAME}/folder/{FOLDER_ID}`. These return an HTML viewer, not the file — they are ingested as garbage and cannot be previewed. Only the `index.php?rm=box_download_shared_file` download URL is accepted.
- Each National Forest has its own vanity name (e.g., `PinyonPublic` for Tahoe NF). Extract it from the scraped content — never hardcode it.
- **Capture EVERY file in EVERY subfolder.** A project's Box root lists several subfolders (Decision, Maps, Scoping, Proposed Action, …). Scrape all of them and submit every PDF — including appendices, maps, and supporting files. Do NOT submit just one "main" document per folder; that drops real project documents.
- **Verify ONE download URL per folder** with `curl -sIL` — a valid file returns `302` then `200` with `content-type: application/pdf`. Every file in the same folder shares the identical `vanity_name` + download pattern, so one check confirms the pattern for the **whole** folder; then submit all files in it. Do **not** `curl` every file — that wastes turns. (Verify one, submit all — never submit one.)

**Fallback if the `firecrawl_scrape` tool is unavailable** (MCP not loaded): the Firecrawl HTTP API still works via Bash, using `$FIRECRAWL_API_KEY` from the environment:

```bash
curl -s -X POST "https://api.firecrawl.dev/v1/scrape" \
  -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "THE_URL", "formats": ["markdown"]}' | jq -r '.data.markdown'
```

### Consequences of Skipping Fetch

If you include core data without `WebFetch` verification:

- Document URLs will be dead links (404)
- Project details will be fabricated and unusable
- Legal citations may be incorrect
- The entire output loses credibility and must be discarded

## What MAY Be Used Without Fetching

You do NOT need `WebFetch` for:

- **General process knowledge** — "NEPA requires public scoping", "CEs typically take 3-6 months"
- **Framework patterns** — standard NEPA phases, typical CE timelines, EIA screening criteria
- **Template structures** — field naming conventions, API schema patterns
- **Memories from verified projects** — durable *patterns* and *locations* only (Box vanity name, folder IDs, CE category, contacts). **Memories are NOT an authoritative document list.** A memory's enumerated file IDs are a hint to which folder to scrape — never the complete set (memories have dropped Scoping Letters and Proposed Actions). Whenever you submit a project's documents, scrape its folder fresh this run to enumerate the current files; do not submit a doc set straight from a cached memory list.

## Forbidden Actions (NEVER DO THESE)

❌ **Claiming a project exists** without fetching its project page
❌ **Including document URLs** without fetching the document or its hosting page
❌ **Creating specific dates** without a fetched schedule or timeline
❌ **Citing legal authority** without fetching the CFR/statute source and confirming content
❌ **Inventing project numbers**, CARA IDs, ePlanning IDs, or tracking numbers
❌ **Submitting duplicate document URLs in the same request**

---

### Pre-Submission Checklist

Before adding ANY URL to a documents array, verify ALL of the following:

1. **Accessibility check** — the URL was confirmed accessible via `WebFetch`
2. **Deduplication check** — the URL is not already present in the documents list
3. **No fallback to web pages** — if no direct file URL exists, **omit the document entirely**

### Document URL Hard Validator (REQUIRED)

**Do NOT trust file extension or `200 OK` alone.** Some portals return HTML placeholder pages with status 200.

Before submitting any document URL, run this validator:

1. **Redirect-resolved URL gate**: after redirects, final URL still has a valid extension
2. **HTML placeholder reject gate**:
   - Reject if content type is `text/html`
   - Reject if fetched content contains placeholder text such as:
     - `This document is not currently available`
     - `You’re offline`
     - `read only version of the page`

If any gate fails, **omit the document** and continue with other verified sources.

#### Bash validation example (preferred)

```bash
# 1) Check headers, redirects, final content type
curl -sIL "$URL"
```

### Deduplication Rule

Never send the same URL twice in one request. Each document URL must appear exactly once.

---

## Document Schema Conventions (Shared)

Both skills (bootstrapper and cataloger) must follow these conventions when submitting documents to the API.

### Document Fields

| Field       | Required | Description                                                                                |
| ----------- | -------- | ------------------------------------------------------------------------------------------ |
| `title`             | Yes      | Must include the official document type for the project's governing framework as a prefix, followed by project/subject name |
| `url`               | Yes      | Direct URL                                                                                 |
| `relevance`         | Yes      | Integer 0-100 — how relevant and useful this document is for the project                   |
| `context`           | Yes      | Substantive explanation of why this document matters for the project                       |
| `folder`            | No       | Source project name for grouping (e.g., "Russell Valley Fuels Reduction"). Documents sharing the same `folder` value are grouped together in the UI |
| `folderDescription` | No       | Review type / level of environmental review of the source project (e.g., "Categorical Exclusion", "Environmental Assessment") |

### Title Convention

The `title` must start with a document type, followed by a dash and the project or subject name. For frameworks with defined official document types, use that framework's official type — never invent one. The types below are the NEPA example set; substitute the equivalent for the project's framework (e.g. CEQA: IS/MND/EIR; EU EIA: Screening/Scoping/EIA Report). For supporting files in a project folder that are NOT a core document (appendices, maps, specialist reports), use a short descriptive type prefix from the **Other** row — do NOT drop the file just because it isn't a core document type. Every PDF in a found project's folder is a wanted document.

**Document Types (NEPA example set — non-exhaustive; other frameworks substitute their equivalents):**

| Category       | Types                                                                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core**       | Categorical Exclusion (CX), Environmental Assessment (EA), Finding of No Significant Impact (FONSI), Environmental Impact Statement (EIS), Draft EIS, Final EIS, Record of Decision (ROD) |
| **Supporting** | Scoping Letter, Notice of Intent (NOI), Decision Memo, Decision Notice, Mitigation Action Plan (MAP), Supplement Analysis, Special Environmental Analysis (SEA)                           |
| **Other**      | Appendix, Map, Treatment Map, Project Plan, Proposed Action, Specialist Report, Technical Report — for supporting files that aren't a core NEPA document but belong to the project folder |

Examples: `"Decision Memo - Peterson Fuel Break"`, `"Environmental Assessment - Trail Maintenance Phase 2"`, `"FONSI - Russell Valley Fuels Reduction"`, `"Appendix - Russell Valley Fuels Reduction (Management Requirements)"`, `"Map - Russell Valley Fuels Reduction (Proposed Treatments)"`

### Relevance Score

Integer 0-100 combining two factors: (1) confidence that the document is appropriate for this project, and (2) how useful it will be for further work.

| Score    | Meaning                                                   |
| -------- | --------------------------------------------------------- |
| 90-100   | Direct project document with high utility                 |
| 70-89    | Closely related (similar project type, same area/agency)  |
| 40-69    | Tangentially related (same framework but different scope) |
| Below 40 | Generic reference                                         |

### Context Field

Must be substantive and factual (zero hallucination). Should cover:

- The document type and what it documents
- The document's relationship to the project (from this project, a similar project, or a generic template)
- What actionable information it contains and how it can be used

**Example:**

```
"Decision Memo from a similar fuel break project on Tahoe NF. Documents the CE category (36 CFR 220.6(e)(6)) and legal authority (HFRA §602) used for authorization, which can serve as a template for structuring your project's NEPA compliance pathway."
```

### Folder Grouping

When multiple documents come from the same source project, set `folder` to the official project name and `folderDescription` to the review type / level of environmental review. All documents sharing the same `folder` value will be grouped together in a folder-like UI.

- Use the exact same `folder` string for all documents from the same project
- `folder` is optional — omit it for standalone documents that don't belong to a specific project group
- `folderDescription` is optional — include it when the review type / level of environmental review is known

**Example:**
```
"folder": "Russell Valley Fuels Reduction",
"folderDescription": "Categorical Exclusion"
```

---

## Fallback: When a Project/Category Doesn't Exist Online

If `WebFetch` finds no evidence of the project or category:

### For Project Bootstrapper:

1. **State clearly** (in agent output only, NOT in progress messages): "❌ PROJECT NOT FOUND after checking [X] sources: [list URLs]"
2. **Use memories**: Read `/memories/project-bootstrapper/` for similar project patterns
3. **Use general patterns**: Apply framework-appropriate templates (NEPA phases, typical timelines)
4. **Mark data appropriately**:
   - Documents: low `relevance` score (below 40) and state in `context` that this is a generic template
   - Milestones: use "estimated" or "typical" duration ranges
   - Fields: omit project-specific values (acreage, project number, CARA ID)
5. **Never pretend**: Do not fabricate project numbers or claim the project exists
6. **Progress messages**: Send a neutral message like `"Researching similar projects for reference"` — never expose "not found" status to users via progress API

### For Project Cataloger:

1. **Skip the project** — do not include it as an example
2. **Search for alternatives** — find a different real project for that category
3. **Never fabricate** — do not invent project names, URLs, or details to fill quotas
4. **Mark category status**: If no examples found, mark category as "needs_examples"

**CRITICAL: If you cannot verify it with `WebFetch`, do not include it as factual data.**

## Research Workflow Examples

### ✅ Correct Workflow

```
User: "Bootstrap Yosemite Trail Maintenance project"

1. WebFetch("https://parkplanning.nps.gov/projectHome.cfm?parkID=347")
   → Search for projects at Yosemite
2. WebFetch("https://www.nps.gov/yose/getinvolved/planning.htm")
   → Check park planning page
3. Result: No "Yosemite Trail Maintenance" project found
4. Explicitly state: "❌ PROJECT NOT FOUND after checking 2 NPS sources"
5. WebFetch 1-2 similar projects for patterns (stop when you have useful data)
6. Read memories: /memories/project-bootstrapper/nps-trail-maintenance.md
7. Write components using:
   - General NPS trail CE patterns (from memories)
   - Estimated timelines (marked as "typical")
   - Template documents (marked as relevance: "template")
   - NO fabricated project numbers or specific dates
```

### ❌ Incorrect Workflow (DO NOT DO THIS)

```
User: "Bootstrap Yosemite Trail Maintenance project"

1. WebFetch("https://parkplanning.nps.gov/") → Got homepage HTML
2. ⛔ Assume project exists because domain is alive
3. ⛔ Write components using training data:
   - "Project found on parkplanning.nps.gov" ← FABRICATED (never fetched project page)
   - "Decision Memo at https://parkplanning.nps.gov/..." ← FABRICATED URL
   - "Scoping began March 2024" ← INVENTED DATE
   - "CE under 516 DM 12.5" ← UNVERIFIED CITATION
   - "Project #YOS-2024-001" ← INVENTED PROJECT NUMBER
```

**Why this is wrong:**

- Fetching the homepage only checks if domain is alive, NOT if the specific project exists
- Never fetched the actual project page with `WebFetch`
- Invented specific details without verification
- User receives unusable, fabricated data

---

## Folder Naming Convention

Format: `YYYY-MM-DD-HHMMh-{name}` (24-hour, no colons)

**IMPORTANT:** The current timestamp is provided in **RUNTIME CONTEXT** section. Look for `Folder Format:`.

## Framework-Adaptive Patterns

Templates adapt their structure to the regulatory framework:

| Field Category           | US NEPA           | EU EIA                              | German BImSchG                  |
| ------------------------ | ----------------- | ----------------------------------- | ------------------------------- |
| **Responsible entity**   | `agency`          | `developer` + `competent_authority` | `operator` + `permit_authority` |
| **Administrative unit**  | `ranger_district` | `voivodeship` / `region`            | `Land` / `Kreis`                |
| **Review level**         | `ce_category`     | `annex_category`                    | `permit_class`                  |
| **Decision document**    | `Decision Memo`   | `Environmental Decision`            | `Genehmigungsbescheid`          |
| **Public participation** | `Scoping Letter`  | `Public Consultation`               | `Öffentlichkeitsbeteiligung`    |

## Supported Agencies (Shared Baseline)

This is a US-focused baseline agency set for both `project-bootstrapper` and `project-cataloger` — it lists US examples, NOT a limit. For projects outside the US, use the project's actual responsible authority and that jurisdiction's environmental registry — do not force-match to this US list.

For `project-cataloger`, treat this as a high-priority baseline, not a hard limit. If the user asks for other valid organizations, continue research beyond this list.

| Agency    | Common Project Types                                                                     |
| --------- | ---------------------------------------------------------------------------------------- |
| **USFS**  | Fuel Break CE, Road Repair CE, Wildfire Resilience CE                                    |
| **BLM**   | Rangeland Management, Trail Maintenance CE, Energy Project Maintenance CE                |
| **NPS**   | Trail Repair CE, Historical Preservation CE, Routine Operations CE                       |
| **DOE**   | Energy Efficiency CE, Facility Maintenance CE, Environmental R&D CE                      |
| **FWS**   | Habitat Restoration CE, Wildlife Survey CE, Fish Stocking CE                             |
| **FHWA**  | Bridge/Road Repair CE, Safety Improvement CE, Highway Maintenance CE                     |
| **USACE** | Navigation Maintenance, Habitat Restoration CE, Emergency Flood Control CE               |
| **FAA**   | Airfield Pavement Repair CE, Navigational Aids CE, Airport Maintenance CE                |
| **EPA**   | Environmental Monitoring CE, Minor Remediation CE, Pollution Control Upgrade CE          |
| **HUD**   | Housing Rehabilitation CE, Affordable Housing Construction CE, Urban Development CE      |
| **DOI**   | Land Boundary Survey CE, Wildland Fire Management CE, Recreation Facility Maintenance CE |
| **USDA**  | Soil Conservation CE, Crop Research CE, Minor Facility Repairs CE                        |
| **NOAA**  | Marine Habitat Restoration, Weather Monitoring Equipment CE, Fisheries Research CE       |

## API Data Submission via curl

**Use `curl` (via the Bash tool) to POST data to the Target API. The native WebFetch tool does NOT support POST requests — always use curl for API submissions.**

### Hard Bash Restriction (Filesystem Safety)

**Bash is for HTTP calls only. Do not use Bash for filesystem operations.**

Forbidden Bash patterns include (non-exhaustive):

- `ls`, `find`, `tree`, `pwd`
- `mkdir`, `touch`, `cp`, `mv`, `rm`, `chmod`, `chown`
- `cat`, `head`, `tail`, `sed`, `awk` when reading local files
- any redirection writing to disk (`>`, `>>`, `tee`, here-docs)

Allowed Bash usage:

- `curl` for API requests only (GET/POST/etc.), including Firecrawl API calls (`api.firecrawl.dev`) when handling bot-protected pages
- optional JSON processing in-memory (for example piping curl output to `jq`) without reading/writing local files

### API Configuration (from RUNTIME CONTEXT)

The following values are provided in **RUNTIME CONTEXT** at the end of your prompt:

| Variable         | Description                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `TARGET_API_URL` | Full base URL for API endpoints (includes root path)                                           |
| `WEBHOOK_SECRET` | Available as `$WEBHOOK_SECRET` env var — include as `x-webhook-secret` header in all API calls |

### Full API Specification

**Refer to `research-agent-spec.md`** for complete request/response schemas, validation rules, and error handling.

### Making API Calls with curl

For each API endpoint, use the Bash tool with `curl`:

```bash
curl -s -X POST "{TARGET_API_URL}/{endpoint}" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{...json payload...}'
```

**Note:** `{TARGET_API_URL}` is substituted from RUNTIME CONTEXT. `$WEBHOOK_SECRET` is a shell environment variable — use it literally (the shell expands them at runtime). Never hardcode the values.

### Skill-to-Endpoint Mapping

| Skill                    | Endpoint                                   | Purpose                                  |
| ------------------------ | ------------------------------------------ | ---------------------------------------- |
| **project-cataloger**    | `POST .../cataloger/project-template`      | Create a new project with full details   |
| **project-bootstrapper** | `POST .../bootstrapper/project/progress`   | Report progress status at key moments    |
| **project-bootstrapper** | `POST .../bootstrapper/project/documents`  | Add documents to existing project        |
| **project-bootstrapper** | `POST .../bootstrapper/project/milestones` | Add milestones/tasks to existing project |
| **project-bootstrapper** | `POST .../bootstrapper/project/fields` | Add custom fields to existing project |
| **project-bootstrapper** | `POST .../bootstrapper/project/context` | Add research context to existing project |
| **project-bootstrapper** | `POST .../bootstrapper/project/timeline` | Add historical timeline events (only for projects found online) |

**CRITICAL:** Each skill uses only its own endpoints. Never use another skill's endpoints.

**CRITICAL:** Progress messages are displayed directly to users. Keep them neutral and forward-looking. Never send internal research states like "not found", "does not exist", or "failed" as progress messages.

### Workflow

1. **Get projectId from RUNTIME CONTEXT** (if applicable — required for bootstrapper)
2. **POST data via `curl`** (Bash tool) to the appropriate endpoint

### Error Handling

**CRITICAL: Sending data to the target API is the primary deliverable of every run. A run that completes research but fails to POST results is a failed run.**

If a `curl` POST to the target API fails:

1. **Diagnose** — Read the response body and HTTP status code. Log what went wrong.
2. **Fix** — If the error suggests a payload issue (4xx), fix the data. If it's a connectivity/server issue (5xx, timeout, empty response), wait a few seconds before retrying.
3. **Retry at least 3 times** — You MUST retry the POST at least 3 times before giving up. Space retries a few seconds apart.
4. **Never silently move on** — If all retries fail, your final message MUST clearly state that the API submission failed, what error occurred, and what data was not delivered.

Specific status codes:

- **403** = schema validation error → fix the data and retry
- **500** = server error → wait 3s and retry
- **4xx (other)** = inspect the response body for details, fix payload, retry
- **Network error / timeout** = wait 5s and retry

## Memory — Self-Improvement Mechanism

The run manager supports a cross-run memory mechanism. Relevant memories from past runs are automatically injected into your RUNTIME CONTEXT. After completing a run, you can save valuable insights for future runs.

### Reading Memories (Automatic)

Relevant memories are already injected in the **RUNTIME CONTEXT** section under `## RELEVANT MEMORIES FROM PAST RUNS`. No action needed — just use them if present.

### Saving Memories (Your Responsibility)

After completing your task, include a `---MEMORIES---` block at the end of your final result if you discovered non-obvious insights worth preserving.

**When to save:**

- Fresh, non-obvious insights discovered during this run
- Source discovery: "This agency publishes documents at [specific URL pattern]"
- Verification patterns: "Project pages on [site] require [specific approach] to extract data"
- API behavior: "[API endpoint] returns [unexpected format] when [condition]"
- Data quality observations: "[Source] is unreliable for [data type]"
- Workflow optimizations: "[Approach] works better than [other approach] for [task type]"

**When NOT to save:**

- Obvious facts anyone would know
- Task-specific details that won't help future runs
- Speculation or unverified claims
- Information already in CLAUDE.md or skill docs

### Format

```
---MEMORIES---
[
  {
    "title": "Short descriptive title",
    "content": "Detailed insight. Be specific and actionable.",
    "keywords": ["keyword1", "keyword2", "keyword3"]
  }
]
---END_MEMORIES---
```

### Keyword Guidelines

- Include 3-7 specific, searchable keywords
- Use lowercase
- Include: agency name, project type, framework, location terms
- Example: `["habitat restoration", "environmental assessment", "wetland", "protected species", "permit"]`

## Key Principles

1. **Real data only** - Never fabricate URLs, coordinates, or contacts
2. **Links must work** - All URLs confirmed accessible via `WebFetch` before adding to output
3. **Authority must match claim** - The cited authority must establish what you claim
4. **Timestamp everything** - Folder names include human-readable timestamp

## Data Quality Requirements

**The data you send via API tools must be real, verified, and high-quality.**

### Document URLs

- **Must be real, working URLs** — always verify by fetching with `WebFetch` before sending to API
- **No duplicates** — each URL must appear only once in the documents array
- **Prefer authoritative government sources**: `.gov` project pages, official document repositories (USFS Box, BLM ePlanning, NPS ParkPlanning)
- **Never fabricate URLs** — if you can't find a real document URL, omit the document entirely

### Source Attribution

- Every piece of data should be traceable to a real source
- The primary source is typically an **official government project page** (e.g., `fs.usda.gov/r05/{forest}/projects/`, `eplanning.blm.gov/`, `cara.fs2c.usda.gov/`)
- If the project doesn't exist online, clearly state this and use only data from similar verified projects

### Fields and Metadata

- Only include fields with **verified, factual values** — never guess or approximate
- Legal citations (CE categories, CFR references) must be verified by fetching the source and confirming the content
- Dates should come from official project timelines, not estimates
- Omit any field where the value is unknown — never use "TBD", "Unknown", "N/A", or placeholder values

## Research Workflow: From Search to Verification

Follow this 4-step workflow for every project research task:

### Step 1: Construct Authoritative URLs

Build URLs for the most likely authoritative sources.

**These patterns are US examples. For other jurisdictions, prefer the responsible authority's own project registry / environmental-assessment portal and the national environmental register; apply the same fetch→verify→cite discipline to whatever the authoritative source is.**

| Agency               | URL Pattern                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| **USFS**             | `https://www.fs.usda.gov/r05/{forest}/projects/{id}` (archived: `…/projects/archive/{id}`) |
| **USFS CARA**        | `https://cara.fs2c.usda.gov/Public/ReadingRoom?project={id}`                |
| **USFS Box**         | `https://usfs-public.app.box.com/v/{VANITY_NAME}/` — `{VANITY_NAME}` is NOT `{forest}Public`; discover it from the project page (e.g. Tahoe NF = `PinyonPublic`) |
| **BLM**              | `https://eplanning.blm.gov/eplanning-ui/project/{id}/510`                   |
| **NPS**              | `https://parkplanning.nps.gov/{park}/{project}`                             |
| **Legal (CFR)**      | `https://www.ecfr.gov/current/title-{title}/chapter-{ch}/part-{part}` (for 36 CFR 220.6 use `https://www.law.cornell.edu/cfr/text/36/220.6` — eCFR removed it) |
| **Federal Register** | `https://www.federalregister.gov/documents/search?conditions[term]={query}` |

### Step 2: Fetch and Extract

```
# Fetch the project page (canonical /projects/{id} form — never the /project/?project= query form)
firecrawl_scrape("https://www.fs.usda.gov/r05/tahoe/projects/61991")

# Analyze the fetched content for:
# - Project name, status, location
# - Document links (PDFs, decision memos)
# - Timeline dates (scoping, comment periods, decisions)
# - Legal framework and authority citations
```

### Step 3: Verify ONE URL Per Folder Before Using

```
# Box documents share an identical download pattern within a folder, so verify
# ONE file per folder with curl -sIL (expect 302 → 200, content-type: application/pdf) —
# that confirms the whole folder. Do NOT curl every file; it wastes turns.
curl -sIL "https://usfs-public.app.box.com/index.php?rm=box_download_shared_file&vanity_name=PinyonPublic&file_id=f_12345"
# Direct .pdf/.docx/.doc — confirm it returns the file, not a 404 or an HTML login/placeholder page.
# Only include URLs that resolve to an actual document (never the /v/.../file/ viewer page).
```

### Step 4: Verify Legal Citations

```
# For each legal citation found, fetch the regulatory source.
# Use Cornell Law for 36 CFR 220.6 — eCFR removed it and returns a feedback form:
WebFetch("https://www.law.cornell.edu/cfr/text/36/220.6")
# Read the fetched content and confirm it contains:
# - The specific section cited (e.g., "220.6")
# - The subsection (e.g., "(e)(6)")
# - Keywords matching the claimed authority (e.g., "hazardous fuels")
# Only include citations where the fetched source confirms the claim
```

### Complete Research Flow Example

```
Project: "Peterson Fuel Break" on Tahoe National Forest

1. firecrawl_scrape("https://www.fs.usda.gov/r05/tahoe/projects/61991")
   → Found: project page with details, links to CARA reading room

2. firecrawl_scrape("https://cara.fs2c.usda.gov/Public/ReadingRoom?project=61991")
   → Extracted: project name, status, scoping dates, document list

3. firecrawl_scrape("https://www.fs.usda.gov/r05/tahoe/projects/61991")
   → Extracted: location details, acreage, CE category, legal authority

4. For each Box folder found, verify ONE download URL (the folder shares one pattern):
   curl -sIL "<box download URL>" → confirm 302 → 200, content-type: application/pdf

5. WebFetch("https://www.law.cornell.edu/cfr/text/36/220.6")
   → Read content, confirm it mentions "220.6", "(e)(6)", "hazardous fuels"
   → Citation verified

6. Write components using ONLY verified, fetched data
```
