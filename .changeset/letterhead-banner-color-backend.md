---
"@wildfires-org/turboplan-db": patch
"@wildfires-org/turboplan-workspace": patch
"@wildfires-org/turboplan-signing": patch
"turboplan-server": patch
---

Document letterheads gain a `banner` layout and an optional accent color. A
banner is the organization's ready-made letterhead graphic (the document logo,
or the library letterhead's logo): PDF exports and signing envelopes draw it at
the full content width at the top of page 1, with no letterhead table. The
accent color (`#rrggbb`) tints the rule under the letterhead and the bold
letterhead name lines. Offices, organizations and library letterheads store the
color; migration `0010_letterhead_banner_color` adds the three nullable columns.
`GET /api/documents/letterhead` returns `markdown: null` for a banner.
