---
"turboplan": patch
---

Fix the sidebar chat list sometimes staying on "Loading..." after a chat
page was opened directly. When a reply finished before the list's first
request did, the refresh it triggered dropped that request and fetched
nothing. The same refresh is what shows a new chat's generated title, so
after a direct page load the sidebar now also picks up that title without a
reload.
