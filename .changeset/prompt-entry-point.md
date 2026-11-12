---
"turboplan": minor
---

A deployment can greet signed-out visitors at `/` with a prompt page
(`NEXT_PUBLIC_ENTRY_POINT=prompt`): a prompt box with PDF/Word attachments and
US Forest Service example projects. Sending it opens `/self-service` with the
project already described, so the visitor confirms an email and starts
planning. Unset, `/` still sends signed-out visitors to login.
