---
"turboplan": patch
"@wildfires-org/turboplan-db": patch
---

Fix chats getting stuck after a reply is cut off. When a reply broke mid-stream
(a dropped connection, a reload, closing the tab), the chat refused every new
message until the page was reloaded, and a document that was being written could
leave a blank reply or a loading card that never finished. You can now send
again straight away, and a step that failed or was cut off says so ("Couldn't
finish creating the document. Try again.") instead of showing nothing.

Replies are also kept more often when the connection drops: the server keeps
generating after the browser goes away and saves the full reply when it can
finish within Cloudflare's grace period, and saves each finished step along the
way so a cut-off reply keeps what was already done.
