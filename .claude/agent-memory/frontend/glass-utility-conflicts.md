---
name: glass-utility-conflicts
description: Landing page glass/glass-card/glass-inset utilities clash with shadcn base classes (bg-*, border, outline-hidden); how to combine them safely
metadata:
  type: feedback
---

When adding `glass`, `glass-card` or `glass-inset` (landing `src/globals.css` custom @utility) to a shadcn/turboplan-utils component that already has `bg-background`, `border border-input` or `focus-visible:outline-hidden`, the result depends on CSS order: same specificity, and tailwind-merge does not know the custom utilities, so it cannot drop the conflicting base classes.

**Why:** Hit while restyling catalog pages (2026-09-24): SelectTrigger, Input and OmniSearch.Input all carry base bg/border/outline classes.

**How to apply:**
- Also pass a class tailwind-merge understands so it strips the base one (`border-0` or `border-white/85`, `bg-white`, `bg-white/55`).
- Use a variant for the glass class when you need it to win (`aria-[expanded=false]:glass-inset`, `hover:bg-white/80`): the variant raises specificity.
- For focus outlines on inputs that have `focus-visible:outline-none/hidden`, add `focus-visible:outline-solid` too, or `--tw-outline-style: none` keeps the outline invisible.
- Glass surfaces own box-shadow; use outline (not ring) for focus so the inset shadow survives.
