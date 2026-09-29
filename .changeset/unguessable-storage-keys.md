---
"@wildfires-org/turboplan-upload": patch
---

Make storage keys for private files unguessable. Uploaded documents and chat
attachments (`uploads/{userId}/…`), signed contracts (`signed/{projectId}/…`)
and MCP uploads (`mcp/{projectId}/…`) are served from public storage URLs whose
key was just a millisecond timestamp plus the filename (MCP added 32 random
bits), so anyone who knew the owner id, file name and rough upload time could
brute-force the URL. New keys now include a full random UUID; existing URLs are
unchanged. Moving private files behind authenticated, expiring links is a
separate follow-up that needs storage configuration changes.
