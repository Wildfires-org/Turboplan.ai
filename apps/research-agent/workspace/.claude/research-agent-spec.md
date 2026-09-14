# Research Agent API Specification

This document defines the canonical API format for project-bootstrapper and project-cataloger skills.

**Single Source of Truth**: Both skills reference this file for API endpoints and data schemas. Update this file once → the skills automatically use the new format.

---

## Skill Endpoint Usage

### project-cataloger

The **project-cataloger** skill uses **1 endpoint**:
- `POST ${TARGET_API_URL}/cataloger/project-template` - Creates a new project with full details from catalog data

### project-bootstrapper

The **project-bootstrapper** skill uses **6 endpoints**:
- `POST ${TARGET_API_URL}/bootstrapper/project/progress` - Reports progress status at key workflow moments
- `POST ${TARGET_API_URL}/bootstrapper/project/documents` - Adds documents to an existing project
- `POST ${TARGET_API_URL}/bootstrapper/project/milestones` - Adds milestones and tasks to an existing project
- `POST ${TARGET_API_URL}/bootstrapper/project/fields` - Adds custom fields to an existing project
- `POST ${TARGET_API_URL}/bootstrapper/project/context` - Adds research context to an existing project
- `POST ${TARGET_API_URL}/bootstrapper/project/timeline` - Adds historical timeline events (only for projects found online)

---

## API Configuration

The API is configured via environment variables:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `TARGET_API_URL` | Full base URL for API endpoints (includes root path) | Yes | None |
| `WEBHOOK_SECRET` | Per-run webhook secret (shell env var `$WEBHOOK_SECRET`) | Yes | None |

---

## API Base URL

The full base URL (including root path) is read from the `TARGET_API_URL` variable in RUNTIME CONTEXT:

```bash
TARGET_API_URL=https://api.research-agent.example.com/api/webhooks/research-agent
```

For local development:
```bash
TARGET_API_URL=http://localhost:8789/api/webhooks/research-agent
```

---

## Authentication

All API requests authenticate with the per-run webhook secret sent as the `x-webhook-secret` header. It is available as a shell environment variable:

```
x-webhook-secret: $WEBHOOK_SECRET
Content-Type: application/json
```

Use `$WEBHOOK_SECRET` directly in curl commands — the shell expands it at runtime. Never hardcode the values.

---

## API Endpoints

### Create Project from Catalog

```
POST ${TARGET_API_URL}/cataloger/project-template
```

Creates a new project with full details from catalog data. Used by **project-cataloger**.

**Request Body:**
```json
{
  "name": "USFS Fuel Breaks Project",
  "description": "A comprehensive fuel breaks project for wildfire management",
  "coverImagePrompt": "Aerial view of forest fuel breaks",
  "prompt": "Create a project for managing USFS fuel breaks",
  "office": {
    "name": "USFS Region 5",
    "description": "US Forest Service Region 5 Office"
  },
  "organization": {
    "name": "US Forest Service Region 5",
    "description": "Federal agency managing forests in California",
    "logoUrl": "https://example.com/usfs-logo.png"
  },
  "documents": [
    {
      "title": "Environmental Assessment - USFS Fuel Breaks",
      "url": "https://example.com/doc1.pdf",
      "relevance": 95,
      "context": "Environmental Assessment (EA) covering scope, objectives, and impact analysis for the USFS fuel breaks initiative in Region 5. Directly applicable as a reference for similar fuel break projects."
    },
    {
      "title": "Environmental Impact Statement - USFS Fuel Breaks",
      "url": "https://example.com/doc2.pdf",
      "relevance": 90,
      "context": "Full Environmental Impact Statement (EIS) documenting alternatives considered, environmental analysis, and mitigation measures. Includes cumulative impact assessment relevant to similar projects in the region."
    }
  ],
  "milestones": [
    {
      "title": "Planning Phase",
      "startDate": "2024-01-01T00:00:00Z",
      "dueDate": "2024-03-31T23:59:59Z",
      "tasks": [
        {
          "title": "Site Assessment",
          "description": "Assess fuel break locations",
          "dependencies": [],
          "startDate": "2024-01-01T00:00:00Z",
          "dueDate": "2024-02-15T23:59:59Z"
        },
        {
          "title": "Stakeholder Meeting",
          "description": "Meet with local communities",
          "dependencies": ["Site Assessment"],
          "startDate": "2024-02-16T00:00:00Z",
          "dueDate": "2024-03-15T23:59:59Z"
        }
      ]
    },
    {
      "title": "Implementation Phase",
      "startDate": "2024-04-01T00:00:00Z",
      "dueDate": "2024-09-30T23:59:59Z",
      "tasks": [
        {
          "title": "Begin Construction",
          "description": "Start fuel break construction",
          "dependencies": ["Planning Phase"],
          "startDate": "2024-04-01T00:00:00Z",
          "dueDate": "2024-09-30T23:59:59Z"
        }
      ]
    }
  ],
  "fields": [
    {
      "label": "Project Type",
      "value": "Wildfire Management"
    },
    {
      "label": "Priority",
      "value": "High"
    }
  ],
  "timeline": [
    {
      "title": "Notice of Intent published in Federal Register",
      "description": "NOI published announcing the proposed fuel breaks project and initiating the scoping process",
      "startedAt": "2023-03-15T00:00:00Z",
      "metadata": { "source": "https://www.federalregister.gov/..." }
    },
    {
      "title": "Public scoping period",
      "description": "30-day public scoping comment period for the fuel breaks project",
      "startedAt": "2023-03-15T00:00:00Z",
      "endedAt": "2023-04-15T00:00:00Z"
    },
    {
      "title": "Environmental Assessment completed",
      "description": "EA finalized following public review and comment incorporation",
      "startedAt": "2023-09-01T00:00:00Z"
    }
  ],
  "rawData": {
    "source": "USFS Website",
    "additionalInfo": "Multiple data sources combined"
  }
}
```

**Required Fields:**
- `name` - Project name (max 100 chars)
- `office` - Office object (see Office schema below)
- `organization` - Organization object (see Organization schema below)

**Optional Fields:**
- `description` - Project description
- `coverImagePrompt` - Prompt for generating cover image
- `prompt` - Project creation prompt
- `documents` - Array of document objects
- `milestones` - Array of milestone objects
- `fields` - Array of field objects
- `timeline` - Array of timeline item objects (historical project events)
- `rawData` - Object containing all found project data as JSON (additionalProperties: true)

**Response (Success - 200):**
```json
{
  "id": "proj_123456",
  "name": "USFS Fuel Breaks Project",
  "status": "created"
}
```

**Response (Error - 401):**
```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

**Response (Error - 403):**
```json
{
  "error": "Schema validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "milestones[0].tasks[0].dependencies",
      "message": "Invalid dependency reference"
    }
  ]
}
```

**Response (Error - 422):**
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "name",
      "message": "Name is required"
    }
  ]
}
```

**Response (Error - 500):**
```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

**Notes:**
- Array order is significant for milestones and tasks
- Multiple projects found are sent individually (one POST per project)
- 403 = schema validation error (agent should fix and retry)
- 500 = server error (retry with backoff)

---

### Report Progress

```
POST ${TARGET_API_URL}/bootstrapper/project/progress
```

Reports progress status at key workflow moments. Used by **project-bootstrapper** to keep users informed about the current step.

**Request Body:**
```json
{
  "runId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Researching web for similar projects"
}
```

**Required Fields:**
- `runId` - Run ID (string) — provided in RUNTIME CONTEXT as `RUN_ID`
- `message` - Human-readable progress message (string)


**Response (Success - 200):**
```json
{
  "success": true
}
```

**Response (Error - 400):**
```json
{
  "error": "Bad request",
  "code": "BAD_REQUEST",
  "details": [
    {
      "field": "runId",
      "message": "Run ID is required"
    }
  ]
}
```

**Response (Error - 401):**
```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

**Notes:**
- Fire-and-forget: progress reporting should not block the workflow. If it fails, log and continue.
- Messages should be short, human-readable status updates (e.g., "Starting project bootstrap", "Sending documents", "Finishing up...")

---

### Add Documents to Project

```
POST ${TARGET_API_URL}/bootstrapper/project/documents
```

Adds documents to an existing project. Used by **project-bootstrapper**.

**Request Body:**
```json
{
  "runId": "550e8400-e29b-41d4-a716-446655440000",
  "projectId": "proj_123456",
  "documents": [
    {
      "title": "Finding of No Significant Impact (FONSI) - Fuel Breaks Initiative",
      "url": "https://example.com/charter.pdf",
      "relevance": 90,
      "context": "FONSI concluding that the fuel breaks initiative does not require a full EIS. Documents the agency's rationale and conditions, useful as a precedent for similar Categorical Exclusion or EA-level projects."
    },
    {
      "title": "Scoping Letter - Region 5 Fuel Break Expansion",
      "url": "https://example.com/specs.pdf",
      "relevance": 75,
      "context": "Scoping Letter (Notice of Intent) initiating public comment for a fuel break expansion. Shows the scoping approach, key issues identified, and stakeholder engagement strategy applicable to similar projects in mixed-conifer forests."
    }
  ]
}
```

**Required Fields:**
- `runId` - Run ID (string) — provided in RUNTIME CONTEXT as `RUN_ID`
- `projectId` - Project ID (string)
- `documents` - Array of document objects (see Document schema below)

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Documents added"
}
```

**Response (Error - 400):**
```json
{
  "error": "Bad request",
  "code": "BAD_REQUEST",
  "details": [
    {
      "field": "projectId",
      "message": "Project ID is required"
    }
  ]
}
```

**Response (Error - 401):**
```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

**Response (Error - 500):**
```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

---

### Add Milestones to Project

```
POST ${TARGET_API_URL}/bootstrapper/project/milestones
```

Adds milestones and tasks to an existing project. Used by **project-bootstrapper**.

**Request Body:**
```json
{
  "runId": "550e8400-e29b-41d4-a716-446655440000",
  "projectId": "proj_123456",
  "milestones": [
    {
      "title": "Phase 1: Planning",
      "startDate": "2024-01-01T00:00:00Z",
      "dueDate": "2024-03-31T23:59:59Z",
      "tasks": [
        {
          "title": "Task 1",
          "description": "First task",
          "dependencies": [],
          "startDate": "2024-01-01T00:00:00Z",
          "dueDate": "2024-01-31T23:59:59Z"
        },
        {
          "title": "Task 2",
          "description": "Second task",
          "dependencies": ["Task 1"],
          "startDate": "2024-02-01T00:00:00Z",
          "dueDate": "2024-02-28T23:59:59Z"
        }
      ]
    }
  ]
}
```

**Required Fields:**
- `runId` - Run ID (string) — provided in RUNTIME CONTEXT as `RUN_ID`
- `projectId` - Project ID (string)
- `milestones` - Array of milestone objects (see Milestone schema below)

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Milestones added"
}
```

**Response (Error - 400):**
```json
{
  "error": "Bad request",
  "code": "BAD_REQUEST",
  "details": [
    {
      "field": "projectId",
      "message": "Project ID is required"
    }
  ]
}
```

**Response (Error - 401):**
```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

**Response (Error - 500):**
```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

**Notes:**
- Array order is significant for milestones and tasks
- Task dependencies reference task titles

---

### Add Fields to Project

```
POST ${TARGET_API_URL}/bootstrapper/project/fields
```

Adds custom fields to an existing project. Used by **project-bootstrapper**.

**Request Body:**
```json
{
  "runId": "550e8400-e29b-41d4-a716-446655440000",
  "projectId": "proj_123456",
  "fields": [
    {
      "label": "Budget",
      "value": "$500,000"
    },
    {
      "label": "Timeline",
      "value": "12 months"
    },
    {
      "label": "Status",
      "value": "Active"
    }
  ]
}
```

**Required Fields:**
- `runId` - Run ID (string) — provided in RUNTIME CONTEXT as `RUN_ID`
- `projectId` - Project ID (string)
- `fields` - Array of field objects (see Field schema below)

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Fields added"
}
```

**Response (Error - 400):**
```json
{
  "error": "Bad request",
  "code": "BAD_REQUEST",
  "details": [
    {
      "field": "projectId",
      "message": "Project ID is required"
    }
  ]
}
```

**Response (Error - 401):**
```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

**Response (Error - 500):**
```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

---

### Add Context to Project

```
POST ${TARGET_API_URL}/bootstrapper/project/context
```

Adds research context (narrative findings, citations, situational notes) to an existing project. Used by **project-bootstrapper**.

**Request Body:**
```json
{
  "runId": "550e8400-e29b-41d4-a716-446655440000",
  "projectId": "proj_123456",
  "context": [
    {
      "label": "NEPA handbook reference",
      "content": "The NPS NEPA handbook Chapter 4 covers trail maintenance CEs under section 4.5.1",
      "url": "https://www.nps.gov/subjects/nepa/upload/NPS-NEPA-Handbook-2015.pdf"
    },
    {
      "label": "Potential legal citation",
      "content": "We may be using the Road CE found at 36 CFR 220.6(e)(1) for road maintenance activities"
    },
    {
      "label": "Site conditions",
      "content": "Wind damage noted in 2024 inspection may affect project scope"
    }
  ]
}
```

**Required Fields:**
- `runId` - Run ID (string) — provided in RUNTIME CONTEXT as `RUN_ID`
- `projectId` - Project ID (string)
- `context` - Array of context item objects (see ContextItem schema below)

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Context added"
}
```

**Response (Error - 400):**
```json
{
  "error": "Bad request",
  "code": "BAD_REQUEST",
  "details": [
    {
      "field": "projectId",
      "message": "Project ID is required"
    }
  ]
}
```

**Response (Error - 401):**
```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

**Response (Error - 500):**
```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

---

### Add Timeline to Project

```
POST ${TARGET_API_URL}/bootstrapper/project/timeline
```

Adds historical timeline events to an existing project. Used by **project-bootstrapper** only when the project was found online. All dates must come from the specific project page — never fabricate or use dates from similar projects.

**Request Body:**
```json
{
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
    }
  ]
}
```

**Required Fields:**
- `projectId` - Project ID (string)
- `timeline` - Array of timeline item objects (see TimelineItem schema below)

**Response (Success - 200):**
```json
{
  "success": true
}
```

**Notes:**
- Only send when the project was found online with real, verifiable dates
- Each timeline item must reference data from the specific project being bootstrapped
- If the project was not found online, do NOT call this endpoint

---

## Data Schemas

### Office Schema

```yaml
name: string                    # Required, max 100 chars
description: string             # Optional
```

**Example:**
```json
{
  "name": "USFS Region 5",
  "description": "US Forest Service Region 5 Office"
}
```

---

### Organization Schema

```yaml
name: string                    # Required, max 255 chars
description: string             # Optional
logoUrl: string                 # Optional, URI format
```

**Example:**
```json
{
  "name": "US Forest Service Region 5",
  "description": "Federal agency managing forests in California",
  "logoUrl": "https://example.com/usfs-logo.png"
}
```

---

### Document Schema

```yaml
title: string                   # Required — should include the NEPA document type (e.g., "Decision Memo - Peterson Fuel Break")
url: string                     # Required, URI format, direct file: path ends with .pdf/.docx/.doc OR a Box download URL (index.php?rm=box_download_shared_file)
relevance: number               # Required — 0-100 score: how relevant and useful this document is for the project
context: string                 # Required — substantive explanation of why this document matters for the project; should mention the NEPA document type
```

**URL Validation Rules:**
- URL must be a **direct file**: a path ending in `.pdf`, `.docx`, or `.doc`, **or** a Box download URL (`...index.php?rm=box_download_shared_file&...`)
- No duplicate URLs in the same request — each document URL must be unique
- NOT web pages, portals, folder views, or Box viewer pages (`/v/.../file/...`)

**Accepted URLs:**
- `https://eplanning.blm.gov/.../BLM_Final_EA.pdf`
- `https://www.fs.usda.gov/Internet/FSE_DOCUMENTS/stelprdb5349994.pdf`
- `https://www.doi.gov/sites/doi.gov/files/report-2024.docx`
- `https://usfs-public.app.box.com/index.php?rm=box_download_shared_file&vanity_name=PinyonPublic&file_id=f_12345` (Box download)

**Rejected URLs:**
- `https://www.fws.gov/program/california-condor-recovery` (web page)
- `https://eplanning.blm.gov/eplanning-ui/project/12345/510` (project portal)
- `https://usfs-public.app.box.com/v/PinyonPublic/file/12345` (Box viewer page — use the `index.php?rm=box_download_shared_file` download URL instead)

**Example:**
```json
{
  "title": "Decision Memo - Peterson Fuel Break",
  "url": "https://example.com/doc1.pdf",
  "relevance": 85,
  "context": "Decision Memo from a similar fuel break project on Tahoe NF. Documents the CE category (36 CFR 220.6(e)(6)) and legal authority (HFRA §602) used for authorization, which can serve as a template for structuring your project's NEPA compliance pathway."
}
```

---

### Milestone Schema

```yaml
title: string                   # Required
startDate: string               # Required, ISO 8601 date-time format
dueDate: string                 # Required, ISO 8601 date-time format
tasks: Task[]                   # Optional, array of Task objects
```

**Example:**
```json
{
  "title": "Planning Phase",
  "startDate": "2024-01-01T00:00:00Z",
  "dueDate": "2024-03-31T23:59:59Z",
  "tasks": [
    {
      "title": "Site Assessment",
      "description": "Assess fuel break locations",
      "dependencies": [],
      "startDate": "2024-01-01T00:00:00Z",
      "dueDate": "2024-02-15T23:59:59Z"
    }
  ]
}
```

---

### Task Schema

```yaml
title: string                   # Required
startDate: string               # Required, ISO 8601 date-time format
dueDate: string                 # Required, ISO 8601 date-time format
description: string             # Optional
dependencies: string[]          # Optional, array of task titles (default: [])
```

**Example:**
```json
{
  "title": "Site Assessment",
  "description": "Assess fuel break locations",
  "dependencies": [],
  "startDate": "2024-01-01T00:00:00Z",
  "dueDate": "2024-02-15T23:59:59Z"
}
```

**Notes:**
- Task dependencies reference task titles (not IDs)
- Dependencies array defaults to empty array if not provided

---

### Field Schema

```yaml
label: string                   # Required
value: string                   # Required
```

**Example:**
```json
{
  "label": "Project Type",
  "value": "Wildfire Management"
}
```

---

### TimelineItem Schema

```yaml
title: string                   # Required — what happened
description: string             # Optional — additional context about the event
startedAt: string               # Optional — ISO 8601 date-time when the event started/occurred
endedAt: string                 # Optional — ISO 8601 date-time when the event ended (for periods like comment windows)
resourceUrls: ResourceUrl[]     # Optional — associated file URLs [{url, filename, type?}]
metadata: object                # Optional — additional structured data (e.g., source URL)
```

**Example:**
```json
{
  "title": "Notice of Intent published in Federal Register",
  "description": "NOI published announcing the proposed fuel breaks project",
  "startedAt": "2023-03-15T00:00:00Z",
  "metadata": { "source": "https://www.federalregister.gov/..." }
}
```

---

### ContextItem Schema

```yaml
label: string                   # Required — short descriptive label
content: string                 # Required — narrative content (no strict length limit)
url: string                     # Optional — source URL when derived from a specific source
```

**Example:**
```json
{
  "label": "NEPA handbook reference",
  "content": "The NPS NEPA handbook Chapter 4 covers trail maintenance CEs under section 4.5.1",
  "url": "https://www.nps.gov/subjects/nepa/upload/NPS-NEPA-Handbook-2015.pdf"
}
```

---

## Validation Rules

Before submitting to Target API, validate:

1. **Required fields present**: All required fields must be provided
2. **Valid URLs**: Document URLs must be valid HTTP/HTTPS URLs
3. **Valid dates**: Date fields must be ISO 8601 format (date-time: `YYYY-MM-DDTHH:mm:ssZ`)
4. **Valid project_id**: Must be provided for bootstrapper endpoints
5. **Array order**: Order is significant for milestones and tasks
6. **Task dependencies**: Must reference valid task titles within the same milestone/project
7. **Document URL file extension**: URL path must end with `.pdf`, `.docx`, or `.doc` — web pages, portals, and folder URLs are rejected
8. **No duplicate document URLs**: Each document URL must appear only once per request

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": [
    {
      "field": "field_name",
      "message": "Detailed error message"
    }
  ]
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad request (missing required fields, invalid format)
- `401` - Unauthorized (missing/invalid authorization token)
- `403` - Schema validation error (agent should fix and retry)
- `422` - Validation error (business logic validation failed)
- `500` - Server error (retry with backoff)

**Error Codes:**
- `UNAUTHORIZED` - Missing or invalid authorization
- `BAD_REQUEST` - Invalid request format
- `VALIDATION_ERROR` - Schema or business logic validation failed
- `INTERNAL_ERROR` - Internal server error

---

## Notes

- All endpoints require the `x-webhook-secret` header
- Timestamps are in ISO 8601 format (date-time: `YYYY-MM-DDTHH:mm:ssZ`)
- Array order is significant for milestones and tasks
- Fields array contains additional project metadata not in main schema
- Multiple projects found are sent individually (one POST per project)
- 401 = missing/invalid authorization
- 403 = schema validation error (agent should fix and retry)
- 500 = server error (retry with backoff)