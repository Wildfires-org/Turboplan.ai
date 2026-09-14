// GENERATED FILE — DO NOT EDIT BY HAND.
// Source of truth: catalog/pricing.yaml + catalog/brand.yaml.
// Regenerate: pnpm --filter @wildfires-org/turboplan-billing generate:catalog

export const CATALOG = {
  "product": "turboplan",
  "billing": {
    "credits_per_usd": 1000,
    "metered_billing": true,
    "price_unit": "base_plus_seats",
    "trial_days": 0,
    "usage_alert_thresholds": [
      70,
      90,
      100
    ],
    "meter_event_name": "turboplan_credits",
    "onboarding": {
      "payment_step_skippable": true
    },
    "flat_credit_costs": {
      "image_generation_primary": 60,
      "image_generation_lite": 15,
      "research_agent_bootstrap": 400,
      "research_agent_cataloger": 200
    },
    "plans": [
      {
        "id": "starter",
        "name": "Starter",
        "headline": "Try AI environmental planning",
        "capability": "Starter AI Planning",
        "jobs": [
          "Basic Research agents",
          "Generate CEQA/NEPA scoping letters",
          "GIS shapefile & unit tracking support"
        ],
        "price_usd": 0,
        "period": "forever",
        "included_seats": 3,
        "additional_seat_price_usd": null,
        "additional_seat_credits": 0,
        "overage_usd_per_credit": null,
        "limits": {
          "credits": 5000,
          "active_projects": 1
        },
        "hard_stop": true,
        "cta": "Get Started"
      },
      {
        "id": "pro",
        "name": "Pro",
        "headline": "Get AI environmental planning right from day 1",
        "capability": "Pro AI Planning",
        "jobs": [
          "Precedent (EA) research",
          "Realtime task + gantt task management",
          "Upload surveys"
        ],
        "price_usd": 99,
        "period": "month",
        "lookup_key": "turboplan_pro_monthly",
        "included_seats": 5,
        "additional_seat_price_usd": 29,
        "additional_seat_credits": 5000,
        "overage_usd_per_credit": 0.006,
        "limits": {
          "credits": 30000
        },
        "unlimited": [
          "projects",
          "docs",
          "contractors"
        ],
        "cta": "Choose Pro"
      },
      {
        "id": "max",
        "name": "Max",
        "headline": "Scale AI environmental planning",
        "capability": "Agentic Planning Team",
        "jobs": [
          "All AI Env Docs (EA/EIR/Decision Memos)",
          "Contract generation",
          "Team/contractor/citizen collaboration"
        ],
        "price_usd": 199,
        "period": "month",
        "lookup_key": "turboplan_max_monthly",
        "included_seats": 10,
        "additional_seat_price_usd": 29,
        "additional_seat_credits": 7500,
        "overage_usd_per_credit": 0.005,
        "limits": {
          "credits": 75000
        },
        "unlimited": [
          "projects",
          "docs",
          "contractors"
        ],
        "priority_support": true,
        "cta": "Choose Max"
      }
    ],
    "enterprise": {
      "bullets": [
        "ArcGIS/Esri + custom integrations",
        "Custom planning agents + credits",
        "Government security + SSO/SAML",
        "Dedicated onboarding + SLA"
      ],
      "cta": "Talk to Us",
      "contact_path": "/contact"
    },
    "discount_programs": [
      {
        "id": "startups",
        "name": "Startup discount",
        "headline": "50% off for early-stage startups",
        "description": "Pre-Series A startups with under $2M revenue in the past 12 months get 50% off any paid TurboPlan plan.",
        "page_slug": "startups",
        "plans": [
          "pro",
          "max"
        ],
        "codes": [
          "STARTUP50"
        ],
        "discount": {
          "percent_off": 50,
          "duration": "repeating",
          "duration_in_months": 12
        },
        "eligibility": {
          "max_redemptions": 100,
          "redeem_by": "2026-12-31"
        },
        "cta": "Signup"
      }
    ]
  }
} as const;

export type Catalog = typeof CATALOG;
export type CatalogPlan = Catalog["billing"]["plans"][number];
