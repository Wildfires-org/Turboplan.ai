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
  researchAgentStatus?: string;
  projectTasksContext?: string;
  savedResearchContext?: string;
  unsavedResearchContext?: string;
  projectDocumentsContext?: string;
  projectContextData?: string;
  projectFieldsContext?: string;
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
  const context = await fetchSystemPromptContext({ projectId, chatId });

  const isResearchPhase = context.mode === ChatMode.Research;

  // Document tools are only available after the research phase is complete
  const hasDocumentTools =
    (isTasksPackageEnabled() || isMapPackageEnabled()) && !isResearchPhase;

  // Reading uploaded project documents works in BOTH research and full mode —
  // it only needs a project (to scope/secure the query) and the documents
  // package enabled.
  const hasReadProjectDocumentsTool =
    !!projectId && isDocumentsPackageEnabled();

  // Project write tools require UPDATE permission on the project. They work in
  // BOTH research and full mode (not research-phase-gated).
  const hasProjectUpdateAccess = await canUserUpdateProject(userId, projectId);
  const hasUpdateProjectContextTool =
    hasProjectUpdateAccess && isProjectContextPackageEnabled();
  const hasUpdateProjectFieldsTool =
    hasProjectUpdateAccess && isFieldsPackageEnabled();

  return {
    ...context,
    activeTools: [
      ...(hasDocumentTools
        ? ["createDocument", "updateDocument", "requestSuggestions"]
        : []),
      ...(hasReadProjectDocumentsTool ? ["readProjectDocuments"] : []),
      ...(hasUpdateProjectContextTool ? ["updateProjectContext"] : []),
      ...(hasUpdateProjectFieldsTool ? ["updateProjectFields"] : []),
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
}: {
  projectId?: string;
  chatId?: string;
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
