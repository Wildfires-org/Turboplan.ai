---
"turboplan": patch
"@wildfires-org/turboplan-upload": patch
---

Documents a visitor attaches to their landing-page prompt now show up as file
attachments on the first chat message, the same way a file uploaded in chat
does. They can be previewed from the message and are sent to the model with
it. Before, the message only had a line of text naming the documents.

- **Prompt kept as written:** the "I've attached … to the project documents"
  note is gone. A visitor who sent documents without a prompt gets a short
  "Please read the attached document(s)" message instead.
- **New:** `getLandingUploadDestination()` in `@wildfires-org/turboplan-upload/server`
  returns where a landing upload will be moved for a user, before it is moved.
