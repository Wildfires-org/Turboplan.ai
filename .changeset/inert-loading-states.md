---
"turboplan": patch
---

Route loading states (office, project and chat) render the real page chrome but
are now inert. Previously a button clicked while a page was still loading — for
example "Submit Application" or "Make Private" — opened a dialog inside the
loading fallback, and the dialog vanished as soon as the real page streamed in.
