import { ChatMode } from "@wildfires-org/turboplan-ai";
import {
  isDocumentsPackageEnabled,
  isFieldsPackageEnabled,
  isMapPackageEnabled,
  isProjectContextPackageEnabled,
  isResearchAgentPackageEnabled,
  isTasksPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";
import {
  getProjectDocumentProfile,
  listProjectLetterheadCandidates,
} from "@wildfires-org/turboplan-workspace/server";
import {
  type DocumentLetterhead,
  documentProfileToFacts,
  type LetterheadCandidate,
} from "@wildfires-org/turboplan-workspace/types";

/**
 * Whether the user may write to the project (UPDATE permission). Fails closed:
 * any error or missing user means no write tools are offered.
 */
const canUserUpdateProject = async (
  userId?: string,
  projectId?: string,
): Promise<boolean> => {
  if (!userId || !projectId) {
    return false;
  }
  try {
    const rbac = getRBACService();
    const result = await rbac.checkPermission(
      userId,
      projectId,
      EntityType.PROJECT,
      Action.UPDATE,
    );
    return result.allowed;
  } catch (error) {
    console.error(
      "[SystemPromptContext] Failed to check UPDATE permission:",
      error,
    );
    return false;
  }
};

/**
 * Whether the user has `action` on the organization (READ includes READ
 * inherited upward from project membership). Fails closed: any error means no
 * organization context is shared and no organization write tool is offered.
 */
const canUserAccessOrganization = async (
  userId: string,
  organizationId: string,
  action: typeof Action.READ | typeof Action.UPDATE,
): Promise<boolean> => {
  try {
    const rbac = getRBACService();
    const result = await rbac.checkPermission(
      userId,
      organizationId,
      EntityType.ORGANIZATION,
      action,
    );
    return result.allowed;
  } catch (error) {
    console.error(
      `[SystemPromptContext] Failed to check organization ${action} permission:`,
      error,
    );
    return false;
  }
};

/**
 * Whether createDocument, updateDocument and requestSuggestions are offered:
 * only after the research phase. An omitted mode is full mode.
 */
const hasDocumentToolsForMode = (mode?: ChatMode): boolean =>
  (isTasksPackageEnabled() || isMapPackageEnabled()) &&
  mode !== ChatMode.Research;

type SystemPromptContext = {
  /** Defaults to ChatMode.Full when omitted. Only set to ChatMode.Research during active research phase. */
  mode?: ChatMode;
  /**
   * True when the project was created via the "Already in progress" path — it
   * skipped the AI research phase, so the research agent never ran and its
   * structured fields were never set up. Drives proactive field creation.
   */
  isBroughtProject?: boolean;
  projectName: string;
  /** Budgeted block from the project's organization (prompt + document facts) */
  organizationContextData?: string;
  /** Organization the block came from; binds readOrganizationDocuments */
  organizationId?: string;
  /** Organization documents whose full text readOrganizationDocuments can return */
  readableOrganizationDocumentIds?: string[];
  /**
   * The project's organization when the user may UPDATE it, set whether or not
   * its context block is empty; binds saveOrganizationMemory
   */
  memoryOrganization?: { id: string; name: string };
  researchAgentStatus?: string;
  projectTasksContext?: string;
  savedResearchContext?: string;
  unsavedResearchContext?: string;
  projectDocumentsContext?: string;
  projectContextData?: string;
  projectFieldsContext?: string;
  officeDocumentContext?: string;
};

/**
 * Builds the full argument object for `systemPrompt()`.
 *
 * Both the chat API route and the debug system-prompt route call this
 * so they always produce the exact same prompt. If you need to change
 * which tools or features are included, change it HERE — not in the
 * individual routes.
 */
export const buildSystemPromptArgs = async ({
  projectId,
  chatId,
  userId,
}: {
  projectId?: string;
  chatId?: string;
  userId?: string;
} = {}) => {
  const context = await fetchSystemPromptContext({ projectId, chatId, userId });

  // Document tools are only available after the research phase is complete
  const hasDocumentTools = hasDocumentToolsForMode(context.mode);

  // Reading uploaded project documents works in BOTH research and full mode —
  // it only needs a project (to scope/secure the query) and the documents
  // package enabled.
  const hasReadProjectDocumentsTool =
    !!projectId && isDocumentsPackageEnabled();

  // Reading organization documents needs the organization block in the prompt
  // (it carries the ids, and was only added after an organization READ check)
  // and at least one document with extracted text. Works in both modes.
  const hasReadOrganizationDocumentsTool =
    !!context.organizationContextData &&
    !!context.organizationId &&
    (context.readableOrganizationDocumentIds?.length ?? 0) > 0;

  // Project write tools require UPDATE permission on the project. They work in
  // BOTH research and full mode (not research-phase-gated).
  const hasProjectUpdateAccess = await canUserUpdateProject(userId, projectId);
  const hasUpdateProjectContextTool =
    hasProjectUpdateAccess && isProjectContextPackageEnabled();
  const hasUpdateProjectFieldsTool =
    hasProjectUpdateAccess && isFieldsPackageEnabled();

  // Saving organization memories needs organization UPDATE, checked (behind
  // the project-context flag) while the context was fetched. Like
  // updateProjectContext it works in both research and full mode.
  const hasSaveOrganizationMemoryTool = !!context.memoryOrganization;

  return {
    ...context,
    activeTools: [
      ...(hasDocumentTools
        ? ["createDocument", "updateDocument", "requestSuggestions"]
        : []),
      ...(hasReadProjectDocumentsTool ? ["readProjectDocuments"] : []),
      ...(hasReadOrganizationDocumentsTool
        ? ["readOrganizationDocuments"]
        : []),
      ...(hasUpdateProjectContextTool ? ["updateProjectContext"] : []),
      ...(hasUpdateProjectFieldsTool ? ["updateProjectFields"] : []),
      ...(hasSaveOrganizationMemoryTool ? ["saveOrganizationMemory"] : []),
      "generateQuickResponses",
      "webSearch",
      "getContents",
      "researchNotes",
    ],
    enabledFeatures: {
      tasks: isTasksPackageEnabled(),
      map: isMapPackageEnabled(),
    },
  };
};

/**
 * Fetch all context pieces needed for the system prompt.
 * Each fetcher is guarded by its feature flag and runs in parallel.
 * Errors are logged but never thrown — missing context is non-fatal.
 */
const fetchSystemPromptContext = async ({
  projectId,
  chatId,
  userId,
}: {
  projectId?: string;
  chatId?: string;
  userId?: string;
} = {}): Promise<SystemPromptContext> => {
  if (!projectId) {
    return { projectName: "" };
  }

  // Fetch project FIRST — projectName is always needed, mode depends on research phase
  const context: SystemPromptContext = {
    projectName: "",
  };

  let isResearchPhaseCompleted = false;
  try {
    const { getProjectById } = await import(
      "@wildfires-org/turboplan-workspace/server"
    );
    const project = await getProjectById(projectId);
    if (project) {
      context.projectName = project.name;
      isResearchPhaseCompleted = project.isResearchPhaseCompleted;
      if (
        isResearchAgentPackageEnabled() &&
        !project.isResearchPhaseCompleted
      ) {
        context.mode = ChatMode.Research;
      }
    }
  } catch (error) {
    console.error("[SystemPromptContext] Failed to fetch project:", error);
  }

  // Now run remaining fetchers in parallel — mode is already resolved
  const fetchers: Promise<void>[] = [];

  // Detect "brought-in" projects (created via the "Already in progress" path):
  // research phase is already marked complete, yet the research agent never ran
  // (no researchAgentChat row for the project's initial chat). Those projects
  // never had their structured fields set up, so we ask the model to create them
  // proactively. Only worth checking when both packages that consume it are on.
  if (
    isResearchPhaseCompleted &&
    isResearchAgentPackageEnabled() &&
    isFieldsPackageEnabled()
  ) {
    fetchers.push(
      (async () => {
        try {
          const { getChatByProjectId, getResearchAgentChatByChatId } =
            await import(
              "@wildfires-org/turboplan-research-agent-integration/server"
            );
          const initialChat = await getChatByProjectId(projectId);
          const researchAgentChat = initialChat
            ? await getResearchAgentChatByChatId(initialChat.id)
            : null;
          if (!researchAgentChat) {
            context.isBroughtProject = true;
          }
        } catch (error) {
          console.error(
            "[SystemPromptContext] Failed to determine brought-project status:",
            error,
          );
        }
      })(),
    );
  }

  if (isTasksPackageEnabled()) {
    fetchers.push(
      (async () => {
        try {
          const {
            DrizzleMilestoneRepository,
            DrizzleUserRepository,
            MilestoneService,
          } = await import("@wildfires-org/turboplan-tasks/server");
          const { generateProjectTasksContext } = await import(
            "@wildfires-org/turboplan-ai"
          );

          const userRepository = new DrizzleUserRepository();
          const milestoneRepository = new DrizzleMilestoneRepository(
            userRepository,
          );
          const milestoneService = new MilestoneService(milestoneRepository);
          const projectTasks =
            await milestoneService.getMilestonesByProjectId(projectId);

          if (projectTasks && projectTasks.length > 0) {
            context.projectTasksContext =
              generateProjectTasksContext(projectTasks);
          }
        } catch (error) {
          console.error(
            "[SystemPromptContext] Failed to fetch project tasks:",
            error,
          );
        }
      })(),
    );
  }

  if (isResearchAgentPackageEnabled() && chatId) {
    fetchers.push(
      (async () => {
        try {
          const { getResearchAgentContextForChat } = await import(
            "@wildfires-org/turboplan-research-agent-integration/server"
          );
          const result = await getResearchAgentContextForChat(chatId, {
            isResearchMode: context.mode === ChatMode.Research,
          });
          if (result) {
            context.savedResearchContext = result.savedContext;
            context.unsavedResearchContext = result.unsavedContext;
            context.researchAgentStatus = result.researchAgentStatus;
          }
        } catch (error) {
          console.error(
            "[SystemPromptContext] Failed to fetch research agent context:",
            error,
          );
        }
      })(),
    );
  }

  if (isDocumentsPackageEnabled()) {
    fetchers.push(
      (async () => {
        try {
          const { getProjectDocumentsContext } = await import(
            "@wildfires-org/turboplan-documents/server"
          );
          context.projectDocumentsContext =
            await getProjectDocumentsContext(projectId);
        } catch (error) {
          console.error(
            "[SystemPromptContext] Failed to fetch documents context:",
            error,
          );
        }
      })(),
    );
  }

  // The office's document details and letterhead: the document generator fills
  // them in itself, so the chat must not list them as missing placeholders.
  fetchers.push(
    (async () => {
      try {
        context.officeDocumentContext = await buildOfficeDocumentContext(
          projectId,
          hasDocumentToolsForMode(context.mode),
        );
      } catch (error) {
        console.error(
          "[SystemPromptContext] Failed to fetch office document details:",
          error,
        );
      }
    })(),
  );

  if (isProjectContextPackageEnabled()) {
    fetchers.push(
      (async () => {
        try {
          const { getProjectContextForChat } = await import(
            "@wildfires-org/turboplan-project-context/server"
          );
          context.projectContextData =
            await getProjectContextForChat(projectId);
        } catch (error) {
          console.error(
            "[SystemPromptContext] Failed to fetch project context:",
            error,
          );
        }
      })(),
    );
  }

  // Organization context (standing prompt + document key facts) is shared
  // only with users who may READ the organization. No user → nothing.
  if (isProjectContextPackageEnabled() && userId) {
    fetchers.push(
      (async () => {
        try {
          const {
            getOrganizationContextForProject,
            ORG_CONTEXT_CHAT_BUDGET,
            ORG_CONTEXT_CHAT_MEMORIES_MAX_CHARS,
            ORGANIZATION_PROMPT_MAX_CHARS,
          } = await import("@wildfires-org/turboplan-workspace/server");
          const organizationContext = await getOrganizationContextForProject(
            projectId,
            {
              budgetChars: ORG_CONTEXT_CHAT_BUDGET,
              promptMaxChars: ORGANIZATION_PROMPT_MAX_CHARS,
              memoriesMaxChars: ORG_CONTEXT_CHAT_MEMORIES_MAX_CHARS,
              readToolName: "readOrganizationDocuments",
            },
          );
          if (!organizationContext) {
            return;
          }
          const canRead = await canUserAccessOrganization(
            userId,
            organizationContext.organizationId,
            Action.READ,
          );
          if (!canRead) {
            return;
          }
          context.organizationContextData = organizationContext.block;
          context.organizationId = organizationContext.organizationId;
          context.readableOrganizationDocumentIds =
            organizationContext.readableDocumentIds;
        } catch (error) {
          console.error(
            "[SystemPromptContext] Failed to fetch organization context:",
            error,
          );
        }
      })(),
    );

    // The organization saveOrganizationMemory writes to. Resolved on its own
    // (the block above is null when the organization has nothing to share
    // yet, which is exactly when a first note gets saved) and in parallel
    // with it, so it adds no latency.
    fetchers.push(
      (async () => {
        try {
          const { getOrganizationIdForProject } = await import(
            "@wildfires-org/turboplan-db/queries"
          );
          const { getOrganizationById } = await import(
            "@wildfires-org/turboplan-workspace/server"
          );
          const organizationId = await getOrganizationIdForProject(projectId);
          if (!organizationId) {
            return;
          }
          const [organization, canUpdate] = await Promise.all([
            getOrganizationById(organizationId),
            canUserAccessOrganization(userId, organizationId, Action.UPDATE),
          ]);
          if (!organization || !canUpdate) {
            return;
          }
          context.memoryOrganization = {
            id: organization.id,
            name: organization.name,
          };
        } catch (error) {
          console.error(
            "[SystemPromptContext] Failed to resolve the organization for memories:",
            error,
          );
        }
      })(),
    );
  }

  if (isFieldsPackageEnabled()) {
    fetchers.push(
      (async () => {
        try {
          const { getProjectFieldsForChat } = await import(
            "@wildfires-org/turboplan-fields/server"
          );
          context.projectFieldsContext =
            await getProjectFieldsForChat(projectId);
        } catch (error) {
          console.error(
            "[SystemPromptContext] Failed to fetch project fields:",
            error,
          );
        }
      })(),
    );
  }

  await Promise.all(fetchers);
  return context;
};

// Admin-written letterhead text goes into the system prompt as data: collapsed
// to one line so it cannot open a new section or pose as an instruction.
const toPromptLine = (text: string) => text.replace(/\s+/g, " ").trim();

const toQuotedPromptValue = (text: string) =>
  `"${toPromptLine(text).replace(/"/g, "'")}"`;

const describeLibraryLetterhead = ({
  id,
  name,
  description,
  firstLine,
}: LetterheadCandidate) => {
  const whenToUse = toPromptLine(description)
    ? toQuotedPromptValue(description)
    : "no description";
  return `- \`${id}\` — ${toQuotedPromptValue(name)}: ${whenToUse} (first line: ${toPromptLine(firstLine)})`;
};

// A banner is only its image; a letterhead without a name line (e.g. a grid
// of contact lines and a logo) is named by its first contact line.
const firstLetterheadLine = (letterhead: DocumentLetterhead) =>
  letterhead.layout === "banner"
    ? "(banner image)"
    : (letterhead.nameLines[0] ?? letterhead.contactLines[0] ?? "(logo)");

const buildAvailableLetterheadsSection = (
  defaultLetterhead: DocumentLetterhead | null,
  library: LetterheadCandidate[],
) => {
  const defaultOption = defaultLetterhead
    ? `office/organization default (first line: ${toPromptLine(firstLetterheadLine(defaultLetterhead))})`
    : "no default letterhead configured — the generator writes the author's letterhead";
  return [
    "# AVAILABLE LETTERHEADS",
    "Pass one id below as createDocument's `letterheadId`: the letterhead of the document's AUTHOR/sender (the same party as in your LETTERHEAD LAYOUT note), never its recipient. Pick a library letterhead only when its name, description or first line identifies that SAME organization — never one that is merely the same kind of organization (another consulting firm, another agency). If the author is a party none of them names, pass `none`. Pass `default` when the office itself is the author or you cannot tell who is. A saved project or organization document used as the reference (by ID or its storage URL) brings its own letterhead when one was read from it; `default` and `none` never replace it. Pass a library letterhead id for such a document only when the user named that letterhead.",
    `- \`default\` — ${defaultOption}`,
    ...library.map(describeLibraryLetterhead),
    "- `none` — no stored letterhead belongs to the author; without a reference letterhead, the generator writes one from your LETTERHEAD LAYOUT note.",
  ].join("\n");
};

const buildOfficeDocumentContext = async (
  projectId: string,
  hasCreateDocumentTool: boolean,
): Promise<string | undefined> => {
  const [profile, { defaultLetterhead: letterhead, library }] =
    await Promise.all([
      getProjectDocumentProfile(projectId),
      listProjectLetterheadCandidates(projectId),
    ]);
  const facts = documentProfileToFacts(profile);
  if (letterhead && letterhead.nameLines.length > 0) {
    facts.unshift(`Letterhead: ${letterhead.nameLines.join(" / ")}`);
  }
  if (letterhead && letterhead.contactLines.length > 0) {
    facts.push(
      `Office address and contact: ${letterhead.contactLines.join(", ")}`,
    );
  }
  const sections: string[] = [];
  if (facts.length > 0) {
    sections.push(
      [
        "# OFFICE DOCUMENT DETAILS",
        "Confirmed by the office. The document generator receives these and fills them into every document automatically (the letterhead is added by the app). Never list them as missing placeholders or ask the user for them.",
        ...facts.map((fact) => `- ${fact}`),
      ].join("\n"),
    );
  }
  // Only orgs with library letterheads get a choice, and only when
  // createDocument (which takes the `letterheadId`) is offered: without the
  // tool, as in research mode, the model writes the ids into its reply.
  // Without a choice the context is exactly the office details above.
  if (hasCreateDocumentTool && library.length > 0) {
    sections.push(buildAvailableLetterheadsSection(letterhead, library));
  }
  return sections.length > 0 ? sections.join("\n\n") : undefined;
};
