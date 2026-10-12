---
"@wildfires-org/turboplan-billing": minor
"turboplan": minor
---

With `IS_BILLING_ENFORCEMENT_ENABLED=false`, extra seats are no longer billed.
Before, the flag only lifted the seat cap: checkout, plan changes, seat sync and
seat reconciliation kept adding the $29/month extra-seat item to Stripe, and the
member-invite dialogs and checkout previews priced extra seats. Now checkout
adds no extra-seat line item, the previews show the flat workspace price, and
the invite-time seat notice is hidden. Credit allowances still include the
per-seat credit grant for every Owner and Editor beyond the included seats, so
organizations keep their credits when those seats stop being billed.

Operator action for deployments running with the flag off: existing
subscriptions keep their extra-seat item until the organization's next seat
sync (any membership change), plan change, `invoice.upcoming` webhook or
reconcile run. Run `POST /api/billing/reconcile` (header `x-reconcile-secret`)
after deploying to converge every subscription at once. The item is removed
without a proration credit, so the current period's seat charge stands and the
seats drop off the next invoice; the one exception is a Pro to Max plan change,
which prorates the whole update. Turning enforcement back on bills extra seats
again from the next seat sync or reconcile.
