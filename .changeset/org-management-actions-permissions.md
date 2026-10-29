---
"turboplan": patch
---

Organization management actions follow the user's actual permissions:
Manage Organization, New Office, Invite Members and the office cards' Edit /
Archive menu now need UPDATE, CREATE or MANAGE_MEMBERS on the organization.
Read access was enough before, so anyone viewing a government organization —
or holding a role on just one of its projects, such as a submitted
application — was offered actions the API would reject.
