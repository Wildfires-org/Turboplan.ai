---
"@wildfires-org/turboplan-billing": patch
---

Stop sending credit usage alert emails (70/90/100%) to Starter organizations
when `IS_BILLING_ENFORCEMENT_ENABLED=false`. With no hard stop in force, the 100%
email wrongly said AI features were paused. Paid plans still get alerts, since
their overage keeps billing.
