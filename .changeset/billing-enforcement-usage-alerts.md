---
"@wildfires-org/turboplan-billing": patch
---

Stop sending credit usage alert emails (70/90/100%) when
`IS_BILLING_ENFORCEMENT_ENABLED=false`, on every plan. Previously they kept
firing with enforcement off, and on Starter the 100% email wrongly said AI
features were paused.
