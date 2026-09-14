---
name: project-bootstrapper
description: Research-first agentic workflow to bootstrap existing and new environmental projects. Researches if project exists, finds similar projects, verifies outputs, and submits structured data to the API.
metadata:
  short-description: Bootstrap existing and new environmental projects with research-first API submission
---

# Project Bootstrapper Skill

## When to Use This Skill

Use when the user:

- Describes an existing project (e.g., "Bootstrap Russell Valley Fuels Reduction project")
- Describes a new project they're starting (e.g., "I'm an environmental planner starting a project...")
- Asks to "bootstrap", "start", or "set up" an environmental project

For existing projects, the skill will find and prefill real project data.
For new projects, the skill will find similar projects as references.

**DATA SUBMISSION:** Use `curl` via the Bash tool to POST data to the Target API (WebFetch does NOT support POST).
**Your endpoints:** `POST .../bootstrapper/project/documents`, `POST .../bootstrapper/project/milestones`, `POST .../bootstrapper/project/fields`, `POST .../bootstrapper/project/context`, `POST .../bootstrapper/project/timeline`
**NEVER use the `/cataloger/project-template` endpoint** — that is exclusively for project-cataloger.

## ⚠️ CRITICAL WORKFLOW REQUIREMENT ⚠️

**FIRST: Check for Project ID**

- **Project ID is provided in RUNTIME CONTEXT** (at the end of this prompt)
- **If Project ID is missing or empty: STOP IMMEDIATELY.** Do not proceed with any research or file operations. Respond with a single message: _"Missing required Project ID. Cannot proceed with project bootstrapping."_

**THEN: Check API Configuration**

- Read `TARGET_API_URL` from RUNTIME CONTEXT; `WEBHOOK_SECRET` is a shell env var (`$WEBHOOK_SECRET`)

**RUNTIME CONTEXT provides:**

- `TARGET_API_URL` - full base URL for API endpoints (includes root path)
- `WEBHOOK_SECRET` - available as `$WEBHOOK_SECRET` shell env var (sent as `x-webhook-secret` header)
- `Project ID` - **required** for all API endpoints

## ⚠️ ZERO HALLUCINATION POLICY ⚠️

**→ See CLAUDE.md for complete ZERO HALLUCINATION POLICY**

Key points for bootstrapper:

- ALL core data requires `WebFetch`/`firecrawl_scrape` verification (project existence, document URLs, dates, legal citations)
- If project not found: explicitly state, use memories + templates, mark as estimated
- Never fabricate: project numbers, CARA IDs, specific dates, document URLs

## ⚠️ MEMORY REQUIREMENT ⚠️

**BEFORE research:**
Relevant memories from past runs are automatically injected in **RUNTIME CONTEXT** under `## RELEVANT MEMORIES FROM PAST RUNS`. No action needed — review them if present to avoid redundant research.

**AFTER completion:**
Include a `---MEMORIES---` block in your final result with non-obvious insights discovered during this run. See the **Memory — Self-Improvement Mechanism** section in CLAUDE.md for the exact format, categories, and keyword guidelines.

## Inputs

Minimum:

- Project description (natural language)

Required:

- **Project ID** - Provided in RUNTIME CONTEXT. **If missing, the skill must stop immediately.**

Optional:

- Organization/office
- Framework (NEPA, CEQA, EU EIA, etc.)
- Location details
- Timeline preferences

---

## ⚠️ RESEARCH FOCUS: API SCHEMA DATA ⚠️

**During ALL research, prioritize finding data that maps to the API schema:**

### 1. DOCUMENTS (Required: title, url, relevance, context; Optional: folder, folderDescription)

Search for and collect URLs to actual project documents:

- Decision Memos, Decision Notices, Scoping Letters
- Environmental Assessments, EIS documents, FONSI, ROD
- Maps, Project Plans, Technical Reports

These are NEPA examples — or the equivalent documents in the project's framework.

**⚠️ MANDATORY — SCRAPE EACH REFERENCE PROJECT'S FOLDER THIS RUN. NEVER SUBMIT A DOC SET FROM MEMORY ALONE.** For every reference (or existing) project whose documents you submit, you MUST `firecrawl_scrape` its Box/source folder and every relevant subfolder (Decision, Scoping, Proposed Action, Maps, EA/Appendices) **this run** to enumerate the current files — even when memory already lists file IDs for it. Memory file IDs are hints to *where* to look, not the authoritative document set: memories are routinely partial (they have dropped the Scoping Letter and Proposed Action before), and submitting straight from a cached list silently loses those documents. "Enough data" for a project = its full, freshly-scraped folder listing — not a memory snippet. If you have memory IDs for a project but do not scrape its folder this run, you are doing it wrong.

When documents come from the same source project, group them using the `folder` field (the source project name) and `folderDescription` (the review type / level of environmental review). This enables folder-like grouping in the UI.

**→ See CLAUDE.md "Document Schema Conventions" for title format, document types, relevance scoring, and context requirements. All four fields (title, url, relevance, context) are required for every document.**

### 2. MILESTONES & TASKS (Required: title, dates, dependencies)

Research project phases and timelines:

- Environmental review phases — e.g. for NEPA: Scoping → Public Comment → EA/EIS → Decision; adapt the phase names to the project's framework
- Implementation phases: Design → Permitting → Construction → Monitoring

### 3. CUSTOM FIELDS (Required: label + value)

Collect key metadata:

- **Framework**: NEPA, CEQA, EU EIA, etc.
- **Review Type**: Categorical Exclusion, EA, EIS
- **CE/Exemption Category**: 36 CFR 220.6(e)(6), etc.
- **Legal Authority**: HFRA §605, IIJA §40806, etc.
- **Location**: State, County, specific site

### 4. PROJECT CONTEXT (Required: label + content, optional: url)

Collect research artifacts and situational findings:

- Legal overviews, regulatory interpretations, citation context
- Handbook or guidance references with source URLs
- Site condition observations, environmental considerations
- Procedural notes, timeline context, inter-agency considerations

### 5. TIMELINE (Optional: title, dates, description) — ONLY for existing projects found online
- Historical project events extracted from the specific project page
- Key dates: NOI publication, scoping periods, public comment windows, draft/final document releases, decisions, amendments
- Use `startedAt` for point-in-time events, `startedAt` + `endedAt` for date ranges (e.g., comment periods)
- **CRITICAL: Only include dates explicitly found on the fetched project page — never fabricate dates**
- **CRITICAL: Timeline data must come from THIS specific project only — never mix in dates from similar projects**
- If the project was NOT found online, do NOT send any timeline items

### Routing Rule: Fields vs Context

**Project Fields** → universal, non-project-specific facts (short label + value).
These are categorical/structural attributes that apply broadly — they classify the project but don't contain project-specific research.
Examples: "Framework: NEPA", "CE Category: 36 CFR 220.6(e)(6)", "Location: Tahoe NF, CA", "Agency: USFS", "Review Type: Categorical Exclusion"

**Project Context** → project-specific research artifacts, citations, situational notes (label + content + optional url).
Any information that is specific to this particular project — its unique circumstances, findings from research, site-specific observations — belongs here.
Examples:

- "NEPA handbook reference" — "The NPS NEPA handbook Chapter 4 covers trail maintenance CEs..." + URL
- "Potential legal citation" — "We may be using the Road CE found at 36 CFR 220.6(e)(1)..." + URL
- "Site conditions" — "Wind damage noted in 2024 inspection may affect project scope"
- "Prior project history" — "This area was previously treated under the 2019 Peterson Fuel Break project"

**Rule of thumb:** If the same label + value would apply to many projects of this type → /fields. If it describes something unique to this project → /context.

When processing legal_overview data:

- Universal facts (framework name, CE category code, agency) → POST to /fields
- Project-specific findings (legal overviews, citation explanations, regulatory observations, site conditions) → POST to /context

---

## Agentic Intake Workflow

```
Step 0: CHECK PROJECT ID & API CONFIG (FIRST STEP - REQUIRED)
        ├── Read `Project ID` from RUNTIME CONTEXT
        ├── If missing/empty → STOP and respond: "Missing required Project ID."
        ├── Note API URL/token from RUNTIME CONTEXT for later
        └── 📡 POST progress: "Starting research for {project name}"

Step 1: RESEARCH - PROJECT EXISTENCE CHECK
        ├── 📡 POST progress: "Searching {source} for {project name}" (e.g., "Searching USFS project registry for Russell Valley")
        ├── Search until you find actionable data, then STOP researching:
        │   1. Start with most promising source (project registry or agency portal)
        │   2. If found: fetch project page for details
        │   3. If NOT found: try similar projects for patterns
        │   4. Legal/regulatory source if needed
        │   5. STOP discovery as soon as you have enough data to write outputs
        │      — but for a project FOUND online, "enough data" means ALL of its
        │        published documents: enumerate every Box subfolder and capture
        │        every file before stopping. Early-stop applies to the search for
        │        WHICH project, not to collecting a found project's documents.
        │
        ├── 📡 POST progress at key transitions (e.g., "Checking Tahoe NF project pages", "Reading Decision Memo for Peterson Fuel Break")
        │
        ├── MANDATORY DECLARATION (after research):
        │   IF PROJECT FOUND:
        │     → Output: "✅ PROJECT FOUND: [project-name] at [URL]"
        │     → 📡 POST progress: "Found project on {source} — collecting data"
        │   IF PROJECT NOT FOUND:
        │     → Output: "❌ PROJECT NOT FOUND after checking [X] sources"
        │     → "Creating template based on memories + similar projects"
        │     → 📡 POST progress: "Researching similar {project type} projects for reference"
        │
        └── Core data sources:
            ├── If found: use fetched project data
            └── If not found: use memories + verified similar projects

Step 2: RESEARCH PROJECT TYPE (find similar projects)
        ├── **Check RUNTIME CONTEXT for injected memories first**
        │   └── Use patterns found to guide research (avoid redundant work)
        ├── Research project type (e.g., "USFS Fuel Break")
        ├── Find similar projects & their docs
        │   └── Priority: same type → same/nearby office → recent
        └── Research legal citations & authority

Step 3: PRE-WRITING CHECK

        Before writing outputs, confirm:
        - [ ] Explicitly declared project status (found/not found)
        - [ ] Can cite a fetched URL for each core data claim in output
        - [ ] No fabricated URLs, dates, or project numbers

        **If you have good data → PROCEED TO STEP 4.**
        **If data is insufficient → do targeted fetches.**

Step 4: AGENTIC LOOP (auto-proceed, non-blocking)
        ┌─────────────────────────────────────┐
        │  Write component data               │
        │          ↓                          │
        │  ⚠️ VERIFY DATA SOURCE              │←── cite source for each field
        │  Every field must cite:             │
        │  - Fetched URL where data found     │
        │  - OR "estimated from memories"     │
        │          ↓                          │
        │  Verify & fix                       │
        │          ↓                          │
        │  📡 POST progress (before each):   │
        │  "Sending documents"               │
        │  "Sending milestones"              │
        │  "Sending fields"                  │
        │  "Sending context"                 │
        │          ↓                          │
        │  POST data via curl (Bash)          │<-- See API Data Submission below
        │          ↓                          │
        │  AUTO-PROCEED to next component     │
        └─────────────────────────────────────┘

Step 5: SAVE MEMORIES (after project completion)
        ├── 📡 POST progress: "Finishing up..."
        ├── Include a ---MEMORIES--- block in your final result
        ├── Summarize key discoveries:
        │   ├── Project patterns found
        │   ├── Document sources that worked
        │   ├── Legal citations discovered
        │   └── API field mappings
        └── See CLAUDE.md "Memory — Self-Improvement Mechanism" for format
```

### Handling Bot-Protected Pages & Box.com (USDA, etc.)

`*.fs.usda.gov`, `*.usda.gov`, and `*.app.box.com` block `WebFetch` (Azure Front Door / JS-rendered Box widgets). Use the `firecrawl_scrape` tool on these pages — it renders JavaScript and returns clean markdown, including the embedded Box.com widgets that host project documents. Go straight to `firecrawl_scrape` for these domains; don't waste a turn on `WebFetch` first.

After scraping the rendered content:

1. Read the Box.com folder URL and vanity name from the markdown (e.g., `PinyonPublic` for Tahoe NF — varies per forest)
2. `firecrawl_scrape` the Box.com folder to list subfolders and files
3. **Scrape EVERY subfolder and capture EVERY file** — Decision, Maps, Scoping, Proposed Action, etc. A found project's Box root lists several subfolders; enumerate them all. Do NOT cherry-pick one "main" document per folder — appendices, maps, and supporting PDFs are all wanted documents.
4. Extract file IDs from the folder listings
5. Construct the download URL: `https://usfs-public.app.box.com/index.php?rm=box_download_shared_file&vanity_name={VANITY_NAME}&file_id=f_{FILE_ID}`
6. Verify ONE download URL per folder with `curl -sIL` — valid files return 302 → 200 with `content-type: application/pdf`. That one check confirms the shared download pattern for **all** files in that folder, so submit every file in it (don't curl each one).

**Submit the download URL, never the `/v/{VANITY_NAME}/file/{FILE_ID}` viewer URL** — viewer pages are ingested as HTML, not the actual file, and cannot be previewed.

See CLAUDE.md "Web Research Tools — Routing & Escalation" and "Box.com Documents — Canonical URL Rule" for full details. If the `firecrawl_scrape` tool is unavailable, the `curl api.firecrawl.dev/v1/scrape` form still works (uses `$FIRECRAWL_API_KEY`).

## API Data Submission via curl

**Use `curl` (via the Bash tool) to POST project data to the Target API. WebFetch does NOT support POST — always use curl.**

**Full API specification:** Refer to `research-agent-spec.md` for complete request/response schemas.

### Endpoints (project-bootstrapper ONLY)

| Endpoint | Purpose | When to Use |
|----------|---------|-------------|
| `POST {TARGET_API_URL}/bootstrapper/project/progress` | Report progress status | At key workflow moments (see below) |
| `POST {TARGET_API_URL}/bootstrapper/project/documents` | Add documents to project | After verifying document data |
| `POST {TARGET_API_URL}/bootstrapper/project/milestones` | Add milestones/tasks | After verifying milestone data |
| `POST {TARGET_API_URL}/bootstrapper/project/fields` | Add custom fields (definite facts) | After verifying field data |
| `POST {TARGET_API_URL}/bootstrapper/project/context` | Add research context (narrative findings) | After verifying context data |
| `POST {TARGET_API_URL}/bootstrapper/project/timeline` | Add historical timeline events | Only when project found online — verified dates only |

**⛔ NEVER use the `/cataloger/project-template` endpoint** — it belongs to the project-cataloger skill.

### Progress Reporting

Report progress at key workflow moments so users know what the agent is doing. Progress calls are fire-and-forget — if one fails, log the error and continue.

**⚠️ Progress messages are shown directly to users in the chat UI.** Never include negative, error, or confusing internal research states in progress messages. Forbidden phrases: "not found", "does not exist", "not available", "failed to find", "cannot find", "can't find", "can't read", "cannot read", "error", "failed", "unable to". Instead, use neutral, forward-looking messages (e.g. "Researching similar projects for reference"). If something fails internally, skip it silently and move on — never surface errors to users via progress.

**⚠️ The final progress message must NOT signal that the process is complete.** The agent continues working after the last progress update (saving memories, cleanup). Using phrases like "done", "complete", "finished", or "all done" in the final message misleads users into thinking the process has ended. Use a continuous/ongoing form instead (e.g. "Finishing up..." not "Research done!").

```bash
curl -s -X POST "{TARGET_API_URL}/bootstrapper/project/progress" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"runId": "{RUN_ID}", "message": "Starting project bootstrap"}'
```

`{RUN_ID}` is provided in RUNTIME CONTEXT. Use it (not the project ID) as the identifier for progress updates.

**Progress messages should reflect what the agent is actually doing.** Include project names, agency names, or document types when known — users want to see the research happening, not generic status labels.

**Example messages** (adapt to the actual project — never use generic placeholders when you have real names):

| Workflow Moment                    | Example Message                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| After project ID check passes      | `"Starting research for Russell Valley Fuels Reduction"`                              |
| Searching for the project          | `"Searching USFS project registry for Russell Valley"`                                |
| Searching a specific source        | `"Checking Tahoe National Forest project pages"`                                      |
| After project found                | `"Found project on fs.usda.gov — collecting data"`                                    |
| After project not found            | `"Researching similar fuel break projects for reference"`                              |
| Reading a document                 | `"Reading Decision Memo for Peterson Fuel Break"`                                     |
| Verifying legal citations          | `"Verifying CE category 36 CFR 220.6(e)(6)"`                                         |
| Before sending documents           | `"Sending 5 verified documents"`                                                      |
| Before sending milestones          | `"Sending project milestones and tasks"`                                               |
| Before sending fields              | `"Sending project details"`                                                            |
| Before sending context             | `"Sending research findings"`                                                          |
| After all submissions complete     | `"Finishing up..."`                                                                    |

**Guidelines:**
- Send progress at key research transitions — not every `WebFetch`, but when you start searching a new source or find something significant
- Include the project name in the first message
- When searching, mention the source (e.g., "Searching BLM ePlanning" not just "Researching")
- When reading a document, mention the document type and project name
- Keep messages short — one line, no technical details

**Full endpoint schema:** See `research-agent-spec.md` → "Report Progress" section.

### How to Call the API

Use the Bash tool with `curl` for each POST:

```bash
curl -s -X POST "{TARGET_API_URL}/bootstrapper/project/{endpoint}" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{...json payload...}'
```

### Data Quality Before API Calls

Before sending data via curl, ensure:

- **No placeholder data** — omit any field where the real value is unknown
- **Document URLs are real** — verified via WebFetch during research
- **No duplicate document URLs** — each URL must appear only once
- **No fabricated URLs, dates, or project numbers**

### Example: POST bootstrapper/project/documents

```bash
curl -s -X POST "{TARGET_API_URL}/bootstrapper/project/documents" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
  "runId": "'"$RUN_ID"'",
  "projectId": "proj_123456",
  "documents": [
    {
      "title": "Decision Memo - Peterson Fuel Break",
      "url": "https://usfs-public.app.box.com/index.php?rm=box_download_shared_file&vanity_name=PinyonPublic&file_id=f_12345",
      "relevance": 85,
      "context": "Decision Memo from a similar fuel break project on Tahoe NF. Documents the CE category (36 CFR 220.6(e)(6)) and legal authority (HFRA §602) used for authorization, which can serve as a template for structuring your project's NEPA compliance pathway.",
      "folder": "Peterson Fuel Break",
      "folderDescription": "Categorical Exclusion"
    },
    {
      "title": "Scoping Letter - Peterson Fuel Break",
      "url": "https://usfs-public.app.box.com/index.php?rm=box_download_shared_file&vanity_name=PinyonPublic&file_id=f_12346",
      "relevance": 80,
      "context": "Scoping letter that initiated the public comment period for the Peterson Fuel Break project.",
      "folder": "Peterson Fuel Break",
      "folderDescription": "Categorical Exclusion"
    }
  ]
}'
```

### Example: POST bootstrapper/project/milestones

```bash
curl -s -X POST "{TARGET_API_URL}/bootstrapper/project/milestones" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
  "runId": "'"$RUN_ID"'",
  "projectId": "proj_123456",
  "milestones": [
    {
      "title": "NEPA Scoping Phase",
      "startDate": "2026-03-01T00:00:00Z",
      "dueDate": "2026-05-31T23:59:59Z",
      "tasks": [
        {
          "title": "Publish Scoping Letter",
          "description": "Draft and publish public scoping notice",
          "dependencies": [],
          "startDate": "2026-03-01T00:00:00Z",
          "dueDate": "2026-03-15T23:59:59Z"
        }
      ]
    }
  ]
}'
```

### Example: POST bootstrapper/project/fields

```bash
curl -s -X POST "{TARGET_API_URL}/bootstrapper/project/fields" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
  "runId": "'"$RUN_ID"'",
  "projectId": "proj_123456",
  "fields": [
    { "label": "Framework", "value": "NEPA" },
    { "label": "Review Type", "value": "Categorical Exclusion" },
    { "label": "Location", "value": "Tahoe National Forest, CA" }
  ]
}'
```

### Example: POST bootstrapper/project/context

```bash
curl -s -X POST "{TARGET_API_URL}/bootstrapper/project/context" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
  "runId": "'"$RUN_ID"'",
  "projectId": "proj_123456",
  "context": [
    {
      "label": "NEPA handbook reference",
      "content": "The NPS NEPA handbook Chapter 4 covers trail maintenance CEs under section 4.5.1",
      "url": "https://www.nps.gov/subjects/nepa/upload/NPS-NEPA-Handbook-2015.pdf"
    },
    {
      "label": "Site conditions",
      "content": "Wind damage noted in 2024 inspection may affect project scope"
    }
  ]
}'
```

### Example: POST bootstrapper/project/timeline

**Only send timeline data when the project was found online. All dates must come from the specific project page.**

```bash
curl -s -X POST "{TARGET_API_URL}/bootstrapper/project/timeline" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
  "projectId": "proj_123456",
  "timeline": [
    {
      "title": "Notice of Intent published",
      "description": "NOI published in Federal Register initiating scoping",
      "startedAt": "2024-03-15T00:00:00Z",
      "metadata": { "source": "https://www.fs.usda.gov/project/tahoe/?project=61991" }
    },
    {
      "title": "Public scoping comment period",
      "description": "30-day public comment period",
      "startedAt": "2024-03-15T00:00:00Z",
      "endedAt": "2024-04-15T00:00:00Z"
    },
    {
      "title": "Decision Memo signed",
      "startedAt": "2024-09-01T00:00:00Z"
    }
  ]
}'
```

### Complete Workflow

```
0. curl POST .../bootstrapper/project/progress     → "Starting research for {project name}"
   ... research phase (send progress at key transitions) ...
   curl POST .../bootstrapper/project/progress     → "Searching {source} for {project name}"
   curl POST .../bootstrapper/project/progress     → "Found project on {source} — collecting data"
                                                      OR "Researching similar {type} projects for reference"
1. curl POST .../bootstrapper/project/progress     → "Sending {N} verified documents"
   curl POST .../bootstrapper/project/documents    → send to API via Bash
2. curl POST .../bootstrapper/project/progress     → "Sending project milestones and tasks"
   curl POST .../bootstrapper/project/milestones   → send to API via Bash
3. curl POST .../bootstrapper/project/progress     → "Sending project details"
   curl POST .../bootstrapper/project/fields       → definite facts only
4. curl POST .../bootstrapper/project/progress     → "Sending research findings"
   curl POST .../bootstrapper/project/context      → research context from legal overview + other findings
5. (IF project found online)
   curl POST .../bootstrapper/project/progress     → "Sending project timeline"
   curl POST .../bootstrapper/project/timeline     → verified historical dates ONLY from this project
6. curl POST .../bootstrapper/project/progress     → "Finishing up..."
```

## Output Directory Structure

```
projects/
└── project-bootstrapper/
    └── {timestamp}-{project-name}/
        ├── maps/
        │   └── units.geojson     # Map units (only if provided)
        └── validation_report.md
```

---

## Project Status Values

| Status             | Description                          |
| ------------------ | ------------------------------------ |
| `proposed`         | New project, not yet in environmental review |
| `scoping`          | In public scoping phase              |
| `decision_pending` | Analysis complete, awaiting decision |
| `approved`         | Decision signed, not yet implemented |
| `implementation`   | Active implementation                |
| `completed`        | Project completed                    |

---

## Document Relevance Types

| Relevance          | Description                       | When to Use                        |
| ------------------ | --------------------------------- | ---------------------------------- |
| `project_document` | Actual document from this project | Existing projects                  |
| `similar_project`  | Reference from a similar project  | New projects                       |
| `template`         | Generic template                  | When no similar project docs found |

**Similar Project Matching Priority:**

1. **Same project type** (e.g., fuel break CE, road repair CE)
2. **Same or nearby office** (same Forest/District > same Region > any)
3. **Recent** (newer projects preferred)

---

## Maps (units.geojson)

**Only include if user provides GeoJSON coordinates. Never fabricate.**

---

## Public Comments

**ONLY include public comments if the project exists online with real data.**

| Comment Category | Example Topics                         |
| ---------------- | -------------------------------------- |
| **Support**      | Community safety, economic benefits    |
| **Opposition**   | Environmental concerns, noise, traffic |
| **Substantive**  | Technical questions, alternatives      |

---

## Supported Agencies and Project Types

Use the shared baseline in `workspace/.claude/CLAUDE.md` under `## Supported Agencies (Shared Baseline)`.

Bootstrapper should prioritize those agencies first for matching and examples.

---

## Key Rules

1. **Check projectId FIRST** - Read Project ID from RUNTIME CONTEXT; if missing, STOP immediately
2. **Research first** - Always research before writing components
3. **Auto-proceed** - Process all components without waiting for user input
4. **Use curl (Bash) for API** - POST to `.../bootstrapper/project/documents`, `.../bootstrapper/project/milestones`, `.../bootstrapper/project/fields`, `.../bootstrapper/project/context`, `.../bootstrapper/project/timeline` (NEVER use `/cataloger/project-template` endpoint)
5. **Route fields vs context** - Definite facts (framework name, CE category code) → /fields; research artifacts, citations, situational notes → /context
6. **Omit unknown fields** - Never include "TBD", "Unknown", or placeholder values
7. **No fabrication** - Never invent map coordinates or fake comments
8. **Skip if not online** - No public comments/activities if project not found
9. **Verify before sending** - All document URLs must be confirmed accessible via `WebFetch`/`firecrawl_scrape`, all legal citations must be verified by fetching the source
10. **Real sources only** - Document URLs must come from authoritative government sources (e.g., `fs.usda.gov`, `eplanning.blm.gov`, `cara.fs2c.usda.gov`), not fabricated or guessed
