---
"turboplan": patch
"@wildfires-org/turboplan-ai": patch
"@wildfires-org/turboplan-signing": patch
---

Chat-generated letters follow one set of formatting rules in the preview, the
PDF and the Word export: bold section headings, single newlines as line breaks
(address and signature blocks), tight right-aligned File Code/Date lines and
space for a signature after the closing. The Word export now uses only widely
supported features (inline logo in the letterhead table, table-border rule,
explicit default styles) so it reads the same in Word, Pages, Google Docs and
LibreOffice. The chat assistant also receives the office's document details,
so it no longer reports them as missing placeholders.
