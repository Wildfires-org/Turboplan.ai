---
name: project-cataloger
description: Research environmental planning project templates from any organization by finding authoritative category citations and verified project examples, then send them to the API.
metadata:
  short-description: Research env planning projects and submit to API
---

# Project Cataloger Skill

Turn a request like "Research caltrans projects" or "Find USFS fuels CEs" into: (1) an authoritative **Project Category** table and (2) a vetted set of real **example projects** with verified public artifacts, submitted to the API.

## When to Use This Skill

Use when the user asks for:

* "project templates" for any organization (agencies, companies, institutions - US, EU, etc.)
* the actual list of categories/exemptions/CEs used in a policy or system
* real example projects + environmental planning artifacts
* structured project data for API submission

## Inputs

Minimum:
* `target` (e.g., `caltrans`, `usfs`, `california`, `eu_eia`)

Optional:
* `frameworks` (e.g., `["CEQA"]`, `["NEPA"]`)
* `sectors` (fuels, transportation, grazing, etc.)
* `org_scope` (specific districts/regions)
* `min_examples_per_category` (default 3)
* `max_categories` (default 25)

## Supported Agencies Baseline (Shared)

Use the shared baseline in `workspace/.claude/CLAUDE.md` under `## Supported Agencies (Shared Baseline)`.

For cataloger, this baseline is a priority starting point, not a hard limit.

---

## API Data Submission via curl

**Use `curl` (via the Bash tool) to POST catalog data to the Target API. WebFetch does NOT support POST — always use curl.**

**⛔ NEVER use the `/bootstrapper/project/documents`, `/bootstrapper/project/milestones`, or `/bootstrapper/project/fields` endpoints** — those are exclusively for the project-bootstrapper skill.

**Full API specification:** Refer to `research-agent-spec.md` for complete request/response schemas.

### API Configuration (from RUNTIME CONTEXT)

| Variable | Description |
|----------|-------------|
| `TARGET_API_URL` | Full base URL for API endpoints (includes root path) |
| `WEBHOOK_SECRET` | Available as `$WEBHOOK_SECRET` shell env var (sent as `x-webhook-secret` header) |
| `RUN_ID` | Available as `$RUN_ID` shell env var — include in JSON body as `"runId"` |

### Workflow

1. Research and verify project data
2. POST each verified project via `curl` (Bash tool) to the `/cataloger/project-template` endpoint

### How to Call the API

Use the Bash tool with `curl` for each POST:

```bash
curl -s -X POST "{TARGET_API_URL}/cataloger/project-template" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"runId": "'"$RUN_ID"'", ...json payload...}'
```

### Example: POST cataloger/project-template

```bash
curl -s -X POST "{TARGET_API_URL}/cataloger/project-template" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
  "runId": "'"$RUN_ID"'",
  "name": "P52 Fuel Break Project",
  "description": "2500-acre fuels reduction project using Categorical Exclusion under HFRA",
  "coverImagePrompt": "Aerial view of a strategic fuel break through dense conifer forest",
  "prompt": "You are an environmental planner creating a USFS fuel break project under NEPA CE",
  "office": {
    "name": "Umatilla National Forest",
    "description": "USFS Region 6 National Forest in northeastern Oregon"
  },
  "organization": {
    "name": "US Forest Service Region 6",
    "description": "Federal agency managing National Forests in Oregon and Washington"
  },
  "documents": [
    { "title": "Decision Memo - P52 Fuel Break", "url": "https://usfs-public.app.box.com/index.php?rm=box_download_shared_file&vanity_name=PinyonPublic&file_id=f_12345", "relevance": 90, "context": "Decision Memo documenting the CE determination and authorization for a USFS fuel break project on Umatilla NF. Shows the applicable CE category and decision rationale." }
  ],
  "milestones": [
    {
      "title": "NEPA Review",
      "startDate": "2026-01-01T00:00:00Z",
      "dueDate": "2026-06-30T23:59:59Z",
      "tasks": [
        {
          "title": "CE Determination",
          "description": "Verify project fits CE category",
          "dependencies": [],
          "startDate": "2026-01-01T00:00:00Z",
          "dueDate": "2026-02-28T23:59:59Z"
        }
      ]
    }
  ],
  "fields": [
    { "label": "Framework", "value": "NEPA" },
    { "label": "CE Category", "value": "36 CFR 220.6(e)(6)" }
  ],
  "timeline": [
    {
      "title": "Decision Memo signed",
      "description": "CE determination authorized under HFRA §602",
      "startedAt": "2025-08-15T00:00:00Z",
      "metadata": { "source": "https://www.fs.usda.gov/project/umatilla/?project=12345" }
    }
  ]
}'
```

---

## ⚠️ ZERO HALLUCINATION POLICY ⚠️

**→ See CLAUDE.md for complete ZERO HALLUCINATION POLICY**

Key points for cataloger:
- ALL core data requires `WebFetch`/`firecrawl_scrape` verification (project existence, category citations, document URLs)
- If project/category not found: skip it, find alternatives
- Never fabricate: project names, URLs, CARA IDs, category codes
- Only verified categories with real examples make it to output

---

## Always Capture These Fields (per template/category)

* `country`: e.g. `USA`, `Poland`, `Germany`
* `framework`: regulatory framework
* `review_type`: level of environmental review
* `category_code`: regulatory category code
* `authority_citation`: legal/policy citation
* `source_url`: authoritative page

### Framework Examples (International)

| Country | Framework | Example review_type | Example category_code |
|---------|-----------|---------------------|----------------------|
| USA | NEPA | Categorical Exclusion | CE-6, 36 CFR 220.6(e)(6) |
| USA | CEQA | CEQA Exemption, IS-MND, EIR | 14 CCR 15301 |
| EU | EU EIA Directive | Full EIA, Screening | Annex I, Annex II |
| Poland | Polish Act 2008 | Full EIA, Screening | Annex I, Annex II |
| Germany | BImSchG | Environmental Permit | §4 BImSchG |

---

# Known Agency Repositories

These are US examples. For other jurisdictions, use the responsible authority's own registry/portal and that jurisdiction's environmental register; apply the same fetch→verify→cite discipline to whatever the authoritative source is.

| Agency | Project Portal | Document Repository |
|--------|---------------|---------------------|
| **USFS** | `fs.usda.gov/project/?project={id}` | `usfs-public.app.box.com/v/PinyonPublic/` |
| **BLM** | `eplanning.blm.gov/eplanning-ui/project/{id}/510` | Same (integrated) |
| **NPS** | `parkplanning.nps.gov` | Same (integrated) |
| **DOE** | `energy.gov/node/{id}` | Same |
| **EPA** | `cdxapps.epa.gov/cdx-enepa-II/public/action/nepa/details?nepaId={id}` | Same |

---

# Implementation Steps

## Step 0: Review Prior Memories

**Check `/memories/project-cataloger/` for relevant patterns and known issues.**

## ⚠️ RESEARCH FOCUS: API SCHEMA DATA ⚠️

**During ALL research, prioritize finding data that maps to the API schema:**

### 1. DOCUMENTS (Required: title, url, relevance, context)
- Decision Memos, Scoping Letters, Environmental Assessments
- **→ See CLAUDE.md "Document Schema Conventions" for title format, document types, relevance scoring, and context requirements. All four fields are required for every document.**
- **DOCUMENT URL HARD RULE: Every document `url` must be a direct file — a path ending in `.pdf`, `.docx`, or `.doc`, OR a Box download URL (`index.php?rm=box_download_shared_file`). Never a web page, portal, or Box viewer/folder page.**
- If no direct file URL exists, **omit the document entirely**
- Never send the same URL twice in one request

### 2. MILESTONES & TASKS (Required: title, dates, dependencies)
- Environmental review phases — e.g. NEPA: Scoping → EA/EIS → Decision; adapt to the project's framework
- Duration estimates and task dependencies

### 3. CUSTOM FIELDS (Required: label + value)
- Framework, Review Type, CE Category, Legal Authority, Location, Project Size

### 4. TIMELINE (Optional: title, dates, description)
- Historical project events found on project pages
- Key dates: NOI publication, scoping periods, draft/final document releases, decisions, amendments
- Use `startedAt` for point-in-time events, `startedAt` + `endedAt` for periods (e.g., comment periods)
- Only include dates that are explicitly stated on the fetched project page — never fabricate dates

---

## Step 1: Parse Request and Scope

* Identify: target entity, framework(s), sectors
* Generate folder name with timestamp: `YYYY-MM-DD-HHMMh-{search-name}`

## Step 2: Research Category Citations

**Hard cap: max 8 WebFetch/firecrawl_scrape/WebSearch calls for the ENTIRE cataloger task. Budget wisely across categories.**

Research approach — search until you find good data, then move on:
1. **Fetch regulatory source** (CFR, statute, policy document) — 1 call
2. **If needed**, fetch agency guidance or category-specific example — 1-2 calls
3. **Stop as soon as you have** `category_code`, `authority_citation`, and `source_url`

**Gate**: Category must have a valid `source_url` AND verified authority citation.

## Step 3: Research Example Projects Per Category

For each project, use the minimum fetches needed:
1. **Fetch project page** to extract details — 1 call
2. **Verify a document URL** if found — 1 call
3. **Stop when you have** project name, office, framework, and at least 1 document URL

* **Every document `url` must be a direct file** — a `.pdf`/`.docx`/`.doc` path or a Box download URL (`index.php?rm=box_download_shared_file`); never a web page, portal, or Box viewer/folder page
* **No duplicate document URLs** — each URL must appear only once across the request
* If a category has no verifiable examples after 2 fetch attempts, skip it

**Gate**: Category must have at least 1 verified project example.

## Step 4: Pre-Writing Check

Before writing output files, confirm:
- [ ] Can cite a fetched URL for each category claim
- [ ] Each included category has at least 1 verified project example
- [ ] No fabricated URLs, project names, or citations

**If you have good data → proceed to writing.**
**If data is insufficient and you still have fetch budget → do targeted fetches.**

## Step 5: Discover and Extract Document URLs

**Key patterns:**
- USFS: `fs.usda.gov/project/` → `firecrawl_scrape` the Box folder → construct `index.php?rm=box_download_shared_file` download URLs (never `/file/{id}` viewer URLs)
- BLM: `eplanning.blm.gov/eplanning-ui/project/` → Documents tab

**CRITICAL: Every document `url` must be a direct file — a `.pdf`/`.docx`/`.doc` path or a Box download URL (`index.php?rm=box_download_shared_file`). Never use web page, portal, or Box viewer/folder URLs in the `url` field. No duplicates.**

**Expansion limits:** max 10 projects/office, 5 offices/org, 100 total documents.

## Step 6: Final Validation and API Submission

* Cross-reference checks

**API submission:**
* POST each verified project to `{TARGET_API_URL}/cataloger/project-template` via `curl` (Bash tool)
* Include `x-webhook-secret: $WEBHOOK_SECRET` header (shell env var)
* Continue even if some API calls fail

## Step 7: Document Memories

Document in `/memories/project-cataloger/{nazwa-pliku}.md`:
- New authoritative data sources
- Agency-specific patterns
- Verification challenges and solutions

---

# Key Principles

1. **No unverified categories** - Must have citation AND example project
2. **Links must work** - All URLs tested before adding to output
3. **Real data only** - Never generate synthetic names or placeholder URLs

---

# Semantic Verification

**Core Principle:** Verify the authority you cite actually establishes the category you claim.

**Authority Hierarchy:** Statute/Law > Regulation > Policy > Guidance
