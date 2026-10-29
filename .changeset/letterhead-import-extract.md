---
"turboplan-server": minor
---

New `POST /api/documents/letterhead/extract` reads a letterhead from an image
of a page header (PNG or JPEG, up to 4 MB) with the primary vision model and
returns its layout, name lines, contact lines, accent color, logo box and
header bottom edge, so the letterhead editor can be prefilled from an existing
document. Requires UPDATE on the office (when given) or the organization, is
limited to 10 calls per minute per user, respects the credit gate and is
metered as document usage.
