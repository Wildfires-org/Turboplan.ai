import { getLandingPageEnv } from "@wildfires-org/turboplan-env";

/**
 * Get the current landing page URL for redirect callbacks.
 * In browser, uses window.location.origin. On server, returns empty string.
 */
const getLandingPageUrl = (): string => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
};

export const routing = {
  home(params?: Record<string, string>) {
    return `/${params ? "?" + new URLSearchParams(params).toString() : ""}`;
  },
  contact() {
    return "/#contact";
  },
  checkout(params?: { plan?: string }) {
    return `/checkout${params?.plan ? `?plan=${encodeURIComponent(params.plan)}` : ""}`;
  },
  pricing() {
    return "/#pricing";
  },
  docs() {
    return "/docs";
  },
  catalog() {
    return "/projects";
  },
  catalogOrganization({ organizationSlug }: { organizationSlug: string }) {
    return `/projects/${organizationSlug}`;
  },
  catalogOffice({
    organizationSlug,
    officeSlug,
  }: {
    organizationSlug: string;
    officeSlug: string;
  }) {
    return `/projects/${organizationSlug}/${officeSlug}`;
  },
  catalogOffices({ organizationSlug }: { organizationSlug: string }) {
    return `/projects/${organizationSlug}/offices`;
  },
  catalogProjects() {
    return "/projects/projects";
  },
  catalogOrganizationProjects({
    organizationSlug,
  }: {
    organizationSlug: string;
  }) {
    return `/projects/${organizationSlug}/projects`;
  },
  catalogOfficeProjects({
    organizationSlug,
    officeSlug,
  }: {
    organizationSlug: string;
    officeSlug: string;
  }) {
    return `/projects/${organizationSlug}/${officeSlug}/projects`;
  },
  catalogProject({
    organizationSlug,
    officeSlug,
    projectSlug,
  }: {
    organizationSlug: string;
    officeSlug: string;
    projectSlug: string;
  }) {
    return `/projects/${organizationSlug}/${officeSlug}/${projectSlug}`;
  },
  catalogTemplate({
    organizationSlug,
    officeSlug,
    templateSlug,
  }: {
    organizationSlug: string;
    officeSlug: string;
    templateSlug: string;
  }) {
    return `/projects/${organizationSlug}/${officeSlug}/templates/${templateSlug}`;
  },
  catalogTemplates() {
    return "/projects/templates";
  },
  catalogOrganizationTemplates({
    organizationSlug,
  }: {
    organizationSlug: string;
  }) {
    return `/projects/${organizationSlug}/templates`;
  },
  catalogOfficeTemplates({
    organizationSlug,
    officeSlug,
  }: {
    organizationSlug: string;
    officeSlug: string;
  }) {
    return `/projects/${organizationSlug}/${officeSlug}/templates`;
  },
  signIn() {
    return `${getLandingPageEnv().TURBOPLAN_URL}/login`;
  },
  /**
   * Dashboard URL - redirects to turboplan app
   */
  dashboard() {
    return getLandingPageEnv().TURBOPLAN_URL;
  },
  /**
   * Profile URL - redirects to turboplan app profile page
   */
  profile() {
    return `${getLandingPageEnv().TURBOPLAN_URL}/profile`;
  },
  /**
   * Settings URL - redirects to turboplan app settings page
   */
  settings() {
    return `${getLandingPageEnv().TURBOPLAN_URL}/settings`;
  },
  /**
   * Sign out URL - turboplan's /logout page clears the session (no confirmation
   * screen) and redirects back to the landing page.
   */
  signOut() {
    const callbackUrl = encodeURIComponent(getLandingPageUrl());
    return `${getLandingPageEnv().TURBOPLAN_URL}/logout?callbackUrl=${callbackUrl}`;
  },
};
