---
"turboplan": patch
"@wildfires-org/turboplan-tasks": patch
"@wildfires-org/turboplan-map": patch
---

Fix project chats showing no messages, or missing the latest reply, after
leaving the chat and coming back with Back or a sidebar link. The chat was
rebuilt from a cached copy of its messages taken when it was first opened, and
ignored the fresh copy fetched afterwards. It now takes the fresh copy as soon
as it is idle, and the cache is refreshed after every reply. A chat started
from "New chat" no longer comes back empty on Back either.

Document artifacts are more reliable too: a stopped or failed document no
longer leaves the artifact stuck loading, the panel always opens once a
document passes 400 characters, and streamed document text is no longer stored
a second time inside the chat message.
