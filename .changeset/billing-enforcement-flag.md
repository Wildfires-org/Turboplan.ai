---
"@wildfires-org/turboplan-feature-flags": minor
"@wildfires-org/turboplan-env": minor
"@wildfires-org/turboplan-billing": minor
---

Add `IS_BILLING_ENFORCEMENT_ENABLED` (and `NEXT_PUBLIC_IS_BILLING_ENFORCEMENT_ENABLED`)
to switch off billing limits — the credit hard-stop, the active-project cap and
the seat cap — while plans, pricing, checkout, Stripe sync and credit metering keep
working. It defaults to on; only an explicit `false` or `0` disables it, and it has
no effect unless the billing package is enabled. New helpers:
`isBillingEnforcementEnabled()` in the feature-flags package and
`isEnvValueExplicitlyFalse()` in the env package.
