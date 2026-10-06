---
"turboplan": patch
---

The chat API now drops any attached file whose URL is not an object in the
app's own storage bucket, in every message of a request (file parts and legacy
`experimental_attachments`). Before, a crafted request or link (for example
`initialAttachments` on a chat URL) could post an external URL that was saved
in the chat, shown to later viewers, and handed to the model, which could make
the server download it.
