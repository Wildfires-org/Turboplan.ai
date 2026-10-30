---
name: reference-letterhead-research-source
description: User decision on research-agent project documents used as createDocument references (label + letterhead) and pending-letterhead reporting
metadata:
  type: project
---

Decided by the user (2026-10-21): a project document with `source: "research"` is an analog project's document. As a createDocument reference it gets the web label (structure/style only, never reuse facts) and its letterhead is copied but NOT selected (only offered in the Letterhead menu). Uploads and organization documents keep the "facts may apply, UNCONFIRMED" label and a selected copy.

A reference whose letterhead analysis is still `pending` is reported in the createDocument result (`letterheadNotes`, reason `letterhead-pending`) only when its copy would be selected; `failed`/`none` are final.

**Why:** a scoping letter came out on another agency's letterhead with its contacts.

**How to apply:** guidance for the chat model goes in the tool result text, not seeded prompts (tool-desc-create-document-footer only explains `letterheadFrom`). If the letterhead analysis loop is off in an environment, rows stay `pending` forever and the pending note repeats.
