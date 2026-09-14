# @wildfires-org/turboplan-billing

Workspace billing for TurboPlan: a declarative pricing catalog, Stripe subscriptions (base plan + extra seats + metered credit overage), per-organization entitlements, and shared credit metering. Billing is scoped to the **organization**, not the individual user.

Gated by the `IS_BILLING_PACKAGE_ENABLED` feature flag (`NEXT_PUBLIC_IS_BILLING_PACKAGE_ENABLED` on the web client). When disabled, credit gating and entitlement checks become no-ops.

## Plans

Defined in `catalog/pricing.yaml` (see [Pricing catalog](#pricing-catalog)); current shipped catalog:

| Plan | Price | Included seats | Credits/mo | Extra seat | Overage | Active projects |
| ---- | ----- | -------------- | ---------- | ---------- | ------- | --------------- |
| Starter | $0 | 3 | 5,000 | — | none (hard stop) | 1 |
| Pro | $99/mo | 5 | 30,000 | $29/mo (+5,000 credits) | metered | unlimited |
| Max | $199/mo | 10 | 75,000 | $29/mo (+7,500 credits) | metered | unlimited |

Plus a "startups" discount program (50% off Pro/Max base for 12 months via a Stripe coupon + promotion code). `extraSeats = max(billableSeats − includedSeats, 0)`; `creditAllowance = plan.credits + extraSeats × additionalSeatCredits`. Credits are shared per org and reset monthly (no banking).

## Exports

- `./client` — `CheckoutView`, `PlanCard` (billing UI building blocks; the full checkout/upgrade flows live in the apps).
- `./server` — Hono routers and services: `billingRouter`, `reconcileRouter`, `stripeWebhookRouter`, plus `credits`, `entitlements`, `metering`, `dunning`, `reconciliation`, `stripe-service`, and `queries`.
- `./types` — `PlanKey`, `PLANS`, `PLAN_ORDER`, and pure catalog math (`extraSeats`, `creditAllowance`, `monthlyBase`, …).

## HTTP endpoints

`billingRouter` is mounted at `/api/billing` (authenticated, per-org RBAC):

| Method | Path | RBAC | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/subscription` | READ | Current subscription + computed `{includedSeats, extraSeats, creditAllowance}` |
| GET | `/usage` | READ | Credits used / allowance / period |
| GET | `/access` | READ | Whether the org has billing access |
| GET | `/billable-organizations` | MANAGE_MEMBERS | Orgs the user can manage billing for |
| POST | `/checkout` | MANAGE_MEMBERS | Start a Stripe Checkout session (Pro/Max) |
| POST | `/select-starter` | MANAGE_MEMBERS | Activate the free Starter plan |
| POST | `/change-plan` | MANAGE_MEMBERS | Switch Pro ↔ Max |
| POST | `/cancel`, `/resume` | MANAGE_MEMBERS | Cancel / resume at period end |
| POST | `/portal` | MANAGE_MEMBERS | Stripe Customer Portal link (payment method, invoices, cancel) |

Two public (unauthenticated, secret-verified) routers mount separately: `POST /api/billing/stripe-webhook` and `POST /api/billing/reconcile`.

## Environment

- `STRIPE_SECRET_KEY` — Stripe API key (test mode unless a live key is explicitly allowed).
- `STRIPE_WEBHOOK_SECRET` — verifies the Stripe webhook signature.
- `RECONCILE_SECRET` — gates the reconcile endpoint (endpoint disabled when unset).

## Pricing catalog

`catalog/pricing.yaml` is the single source of truth for plans, seats, credit pools, overage rates and discount programs. `catalog/brand.yaml` holds the two Stripe-identity values — `product` (prefix of every lookup key, catalog key and coupon id) and `meter_event_name` — split out because they are fork-owned (`merge=ours`) and effectively immutable once synced (see [Renaming product or meter](#renaming-product-or-meter)). `scripts/load-catalog.ts` merges the two; the merged document compiles to the checked-in `src/generated/catalog.ts` (Cloudflare Workers have no runtime filesystem):

```bash
pnpm --filter @wildfires-org/turboplan-billing generate:catalog        # regenerate
pnpm --filter @wildfires-org/turboplan-billing generate:catalog:check  # CI drift gate (runs inside typecheck)
```

## Stripe sync

Reconciles Stripe against the catalog. Requires `apps/server/.env` with a test-mode `STRIPE_SECRET_KEY` (live keys are refused without `--live`).

```bash
pnpm --filter @wildfires-org/turboplan-billing sync:stripe             # dry run
pnpm --filter @wildfires-org/turboplan-billing sync:stripe -- --apply  # apply
pnpm --filter @wildfires-org/turboplan-billing sync:stripe             # verify: zero drift
```

Contract:

- The dry run prints the diff and **exits 1 while drift exists** — the loop above must end with a clean run.
- Prices are found by lookup key. Immutable drift creates a replacement price and transfers the lookup key; a subscribed price is never mutated, and existing subscriptions keep their old price (grandfathering).
- Coupons are immutable, so terms changes create `<program>-vN+1` and re-point the promotion codes. Nothing in Stripe is ever deleted.
- `REPORT` lines flag catalog-tagged objects Stripe has but the catalog doesn't — they are surfaced, never touched.
- Products are found by `metadata.catalog_key`. Products synced before that key became brand-independent (tagged `eplan_catalog_key`) are still recognised and re-tagged under `--apply`; the legacy list in the script can be dropped once every synced account has been re-tagged.

### Renaming product or meter

Changing `product` or `meter_event_name` in `catalog/brand.yaml` changes the identity of every Stripe object, and two of them are immutable in Stripe: a price's lookup key can only move by creating a replacement price, and a meter's `event_name` can never change. Do not do this on an account with live subscriptions unless you follow this order:

1. `sync:stripe -- --apply` **first**. It creates the new meter, the new base/seat prices under the new lookup keys, and new overage prices bound to the new meter. Old prices stay active but lose their lookup keys; existing subscriptions keep billing them (grandfathering).
2. Deploy the runtime **after** step 1. From this deploy on, `consumeCredits` reports usage to the new meter event name — if the meter does not exist yet Stripe rejects every usage event and overage is silently lost.
3. Existing subscribers still sit on prices whose lookup keys are gone, so `classifyLookupKey` cannot map their items to a plan. Migrate each subscription's items to the new prices (a subscription update with proration disabled), then archive the old prices.
4. Keep the old meter until the last billing period that reported to it has invoiced, then deactivate it.

A fresh Stripe account (no subscriptions) needs none of this — just sync.

## Credit metering

Every metered AI call: `assertCreditsAvailable(orgId)` before the model call (throws 402 `CREDITS_EXHAUSTED` on hard-stop plans), then `consumeCredits({...})` after it with the observed cost. Overage beyond the allowance is reported to a Stripe billing meter with the ledger row id as the idempotent event identifier. Usage crossing 70/90/100% of the allowance triggers alert emails (via `@wildfires-org/turboplan-mail`).

## Reconcile endpoint

`POST /api/billing/reconcile` (header `x-reconcile-secret`, disabled when `RECONCILE_SECRET` is unset) runs three sweeps: unreported overage (run at least daily — Stripe's duplicate-identifier window is ~24h), the full seat scan, and the 30/7-day discount-ending notices. Point any external scheduler at it; no platform cron is required.
