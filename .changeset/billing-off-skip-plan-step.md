---
"@wildfires-org/turboplan-billing": patch
"turboplan": patch
"turboplan-landing-page": patch
---

With `IS_BILLING_ENFORCEMENT_ENABLED=false`, onboarding no longer shows the
`/setup/plan` step. No plan unlocks anything while enforcement is off, so new
users now go straight from their profile to the app, and returning users are no
longer routed to the plan step at login. Nothing is stamped on their personal
organization, so if enforcement is turned back on they see the plan step once.

The landing page's `/checkout` page and checkout modal also stop saying "seats
beyond the included count bill separately" while enforcement is off; they now
show "A flat monthly workspace price.", matching the in-app checkout.
