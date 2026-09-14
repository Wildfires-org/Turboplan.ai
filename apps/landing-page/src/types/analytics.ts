// Event names follow the snake_case noun_verb taxonomy shared with the
// server-side tracking plan (e.g. `user_signed_up`).
export const events = {
  TRY_IT_CLICKED: "try_it_clicked",
  HERO_PROMPT_SUBMITTED: "hero_prompt_submitted",
  CATALOG_REQUEST_CLICKED: "catalog_request_clicked",
  PRICING_PLAN_CLICKED: "pricing_plan_clicked",
  ENTERPRISE_CONTACT_CLICKED: "enterprise_contact_clicked",
  STARTUP_DISCOUNT_CLICKED: "startup_discount_clicked",
  PRICING_NAV_CLICKED: "pricing_nav_clicked",
  PROJECTS_CLICKED: "projects_clicked",
  CONTACT_CLICKED: "contact_clicked",
  CONTACT_SUPPORT_CLICKED: "contact_support_clicked",
  QUICK_START_SELECTED: "quick_start_selected",
  SIGN_IN_CLICKED: "sign_in_clicked",
  DOCS_CLICKED: "docs_clicked",
  SIGNUP_STARTED: "signup_started",
} as const;
