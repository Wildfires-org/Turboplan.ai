---
"turboplan": patch
---

Chats on a project still in its research phase no longer get the list of the
organization's library letterheads. That list tells the model to pass a
letterhead id to `createDocument`, which research mode does not offer, so asking
for a letter during project setup made the model write the letter into its reply
with the raw letterhead id (`LETTERHEAD: <uuid>`) at the top. Once the research
phase is complete the list is offered again, alongside `createDocument`.
