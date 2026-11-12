---
"turboplan-landing-page": minor
"@wildfires-org/turboplan-billing": patch
---

The landing page and docs carry the Wildfires.org brand: the Wildfires logo in
the navbar and footer, a new favicon and social card, and the Wildfires palette
(orange accents, cream ground, forest-green primary buttons). The previous
mascot illustrations are gone: feature screenshots stand on their own, the
not-found pages show the Wildfires mark and the catalog empty states an icon.
`src/lib/brand.ts` gains two keys, `logoAlt` and `mark`; forks that keep their
own copy of that file need to add them.

The Stripe catalog sync derives the legacy product-prefixed metadata key
(`<product>_catalog_key`) from `catalog/brand.yaml` instead of hard-coding it.
