---
"turboplan-landing-page": patch
---

The hero prompt works better on phones: its text is 16px so iOS Safari no
longer zooms in on focus, the attach and send buttons sit under the text instead
of squeezing it into a narrow column, and a send before the page has hydrated
keeps the typed text (the textarea is named `projectDescription`, which the
hero already reads back).
