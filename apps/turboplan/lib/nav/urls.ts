/**
 * Centralized URL management for the application.
 * Use these getters to construct URLs throughout the app.
 * This allows easy adjustments to URL patterns in one place.
 */

// Own entry, not the package root: the root is a `'use client'` module that
// server components cannot call into, and `/server` reads env. `app-paths` is
// framework free, so both server and client modules can use AppUrls.
import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";

// ============================================================================
// Static Routes
// ============================================================================

export const AppUrls = {
  // Root routes
  home: "/",
  login: "/login",
  register: "/register",
  profile: "/profile",
  settings: "/settings",
  admin: "/admin",

  // ============================================================================
  // Organization Routes
  // ============================================================================

  /**
   * Get the URL for an organization page
   * @example AppUrls.organization("my-org") → "/my-org"
   */
  organization(orgSlug: string): string {
    return appPaths.organization(orgSlug);
  },

  /**
   * Get the URL for an organization members page
   * @example AppUrls.organizationMembers("my-org") → "/my-org/members"
   */
  organizationMembers(orgSlug: string): string {
    return `${this.organization(orgSlug)}/members`;
  },

  /**
   * Get the URL for the organization signing (my pending signatures) page
   * @example AppUrls.organizationSigning("my-org") → "/my-org/my-signatures"
   */
  organizationSigning(orgSlug: string): string {
    return `${this.organization(orgSlug)}/my-signatures`;
  },

  /**
   * Get the URL for the organization billing page
   * @example AppUrls.organizationBilling("my-org") → "/my-org/billing"
   */
  organizationBilling(orgSlug: string): string {
    return `${this.organization(orgSlug)}/billing`;
  },

  /**
   * Get the URL for the organization context (AI prompt + documents) page
   * @example AppUrls.organizationContext("my-org") → "/my-org/context"
   */
  organizationContext(orgSlug: string): string {
    return `${this.organization(orgSlug)}/context`;
  },

  // ============================================================================
  // Office Routes
  // ============================================================================

  /**
   * Get the URL for an office page
   * @example AppUrls.office("my-org", "my-office") → "/my-org/my-office"
   */
  office(orgSlug: string, officeSlug: string): string {
    return appPaths.office(orgSlug, officeSlug);
  },

  /**
   * Get the URL for an office members page
   * @example AppUrls.officeMembers("my-org", "my-office") → "/my-org/my-office/members"
   */
  officeMembers(orgSlug: string, officeSlug: string): string {
    return `${this.office(orgSlug, officeSlug)}/members`;
  },

  /**
   * Get the URL for an office citizen submissions page
   * @example AppUrls.officeCitizenSubmissions("my-org", "my-office") → "/my-org/my-office/citizen-submissions"
   */
  officeCitizenSubmissions(orgSlug: string, officeSlug: string): string {
    return `${this.office(orgSlug, officeSlug)}/citizen-submissions`;
  },

  /**
   * Get the URL for an office "my submissions" page (citizen view)
   * @example AppUrls.officeMySubmissions("my-org", "my-office") → "/my-org/my-office/my-submissions"
   */
  officeMySubmissions(orgSlug: string, officeSlug: string): string {
    return `${this.office(orgSlug, officeSlug)}/my-submissions`;
  },

  /**
   * Get the URL for office document templates
   */
  officeDocumentTemplates(orgSlug: string, officeSlug: string): string {
    return `${this.office(orgSlug, officeSlug)}/templates/document`;
  },

  /**
   * Get the URL for office project templates
   */
  officeProjectTemplates(orgSlug: string, officeSlug: string): string {
    return `${this.office(orgSlug, officeSlug)}/templates`;
  },

  // ============================================================================
  // Template Routes
  // ============================================================================

  /**
   * Get the URL for a template detail page
   * @example AppUrls.template("my-org", "my-office", "my-template") → "/my-org/my-office/templates/my-template"
   */
  template(orgSlug: string, officeSlug: string, templateSlug: string): string {
    return `${this.officeProjectTemplates(orgSlug, officeSlug)}/${templateSlug}`;
  },

  // ============================================================================
  // Project Routes
  // ============================================================================

  /**
   * Get the URL for a project page
   * @example AppUrls.project("my-org", "my-office", "my-project") → "/my-org/my-office/my-project"
   */
  project(orgSlug: string, officeSlug: string, projectSlug: string): string {
    return appPaths.project(orgSlug, officeSlug, projectSlug);
  },

  /**
   * Get the URL for a project overview page
   */
  projectOverview(
    orgSlug: string,
    officeSlug: string,
    projectSlug: string,
  ): string {
    return `${this.project(orgSlug, officeSlug, projectSlug)}/overview`;
  },

  /**
   * Get the legacy project chat URL.
   * Compatibility route only: `/chat` redirects to a concrete `/chats/*` route.
   * Keep this for backward compatibility and explicit redirect coverage.
   */
  projectChat(
    orgSlug: string,
    officeSlug: string,
    projectSlug: string,
  ): string {
    return `${this.project(orgSlug, officeSlug, projectSlug)}/chat`;
  },

  /**
   * Get the URL for a specific project chat by ID
   */
  projectChatById(
    orgSlug: string,
    officeSlug: string,
    projectSlug: string,
    chatId: string,
  ): string {
    return `${this.project(orgSlug, officeSlug, projectSlug)}/chats/${chatId}`;
  },

  /**
   * Get the URL for creating a new project chat
   */
  projectNewChat(
    orgSlug: string,
    officeSlug: string,
    projectSlug: string,
  ): string {
    return `${this.project(orgSlug, officeSlug, projectSlug)}/chats/new`;
  },

  /**
   * Get the URL for a project tasks page
   */
  projectTasks(
    orgSlug: string,
    officeSlug: string,
    projectSlug: string,
  ): string {
    return `${this.project(orgSlug, officeSlug, projectSlug)}/tasks`;
  },

  /**
   * Get the URL for a project map page
   */
  projectMap(orgSlug: string, officeSlug: string, projectSlug: string): string {
    return `${this.project(orgSlug, officeSlug, projectSlug)}/map`;
  },

  /**
   * Get the URL for a project timeline page
   */
  projectTimeline(
    orgSlug: string,
    officeSlug: string,
    projectSlug: string,
  ): string {
    return `${this.project(orgSlug, officeSlug, projectSlug)}/timeline`;
  },

  /**
   * Get the URL for a project documents page
   */
  projectDocuments(
    orgSlug: string,
    officeSlug: string,
    projectSlug: string,
  ): string {
    return `${this.project(orgSlug, officeSlug, projectSlug)}/documents`;
  },

  /**
   * Get the URL for a project signing page
   */
  projectSigning(
    orgSlug: string,
    officeSlug: string,
    projectSlug: string,
  ): string {
    return `${this.project(orgSlug, officeSlug, projectSlug)}/signing`;
  },

  /**
   * Get the URL for a project context page
   */
  projectContext(
    orgSlug: string,
    officeSlug: string,
    projectSlug: string,
  ): string {
    return `${this.project(orgSlug, officeSlug, projectSlug)}/context`;
  },

  /**
   * Get the URL for a project comments page
   */
  projectComments(
    orgSlug: string,
    officeSlug: string,
    projectSlug: string,
  ): string {
    return `${this.project(orgSlug, officeSlug, projectSlug)}/comments`;
  },

  /**
   * Get the URL for a project members page
   */
  projectMembers(
    orgSlug: string,
    officeSlug: string,
    projectSlug: string,
  ): string {
    return `${this.project(orgSlug, officeSlug, projectSlug)}/members`;
  },

  // ============================================================================
  // Project Subroutes Array (for navigation validation)
  // ============================================================================

  /**
   * Get all project subroute prefixes for active link detection.
   * Includes both primary `/chats` and legacy `/chat` prefixes.
   */
  projectSubroutes(
    orgSlug: string,
    officeSlug: string,
    projectSlug: string,
  ): string[] {
    const base = this.project(orgSlug, officeSlug, projectSlug);
    return [
      base,
      `${base}/overview`,
      `${base}/chat`,
      `${base}/chats`,
      `${base}/tasks`,
      `${base}/timeline`,
      `${base}/map`,
      `${base}/documents`,
      `${base}/signing`,
      `${base}/context`,
      `${base}/comments`,
      `${base}/members`,
    ];
  },
} as const;
