---
"@wildfires-org/turboplan-workspace": patch
---

Bind invitations to the invited email address. When the invited address had
registered after the invite was sent, opening the invite link signed the holder
straight into that existing account, so a forwarded or leaked invite email was a
login credential for up to 7 days; the link now sends existing accounts to the
normal login flow (with a safe `callbackUrl` back to the invite) instead.
`POST /api/invitations/accept` now returns 403 `INVITATION_EMAIL_MISMATCH` when
the signed-in user's email differs from the invited one, and the invite page
explains which account to sign in with. Invitations now expire after 3 days
instead of 7. The login page forwards a safe relative `callbackUrl` into the
magic link.
