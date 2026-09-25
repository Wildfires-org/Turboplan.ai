---
"@wildfires-org/turboplan-upload": patch
---

Stop users from deleting storage objects they do not own. Organization and
office logo fields accepted any URL in our bucket and the next update deleted
the previous value, so a user could point their own org's logo at someone
else's file and then delete it; MCP `delete_project_document` deleted the
document's file even when the row was a copy made from a template, destroying
the template's original. Logo fields now only accept bucket URLs the caller
uploaded (external URLs are unchanged), and every delete path goes through one
helper that removes the object only when it sits under the deleting context's
own prefix and no other project document still references it. Omitting a logo
field in an org or office update no longer deletes the stored logo.
