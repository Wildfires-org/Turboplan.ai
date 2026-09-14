import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerCapabilityTools } from "./tools/capabilities.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerContextTools } from "./tools/context.js";
import { registerCoverImageTools } from "./tools/cover-image.js";
import { registerDocumentTools } from "./tools/documents.js";
import { registerFieldTools } from "./tools/fields.js";
import { registerMemberTools } from "./tools/members.js";
import { registerMilestoneTools } from "./tools/milestones.js";
import { registerOfficeTools } from "./tools/offices.js";
import { registerOrganizationTools } from "./tools/organizations.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerSummaryTools } from "./tools/summary.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerTimelineTools } from "./tools/timeline.js";
import type { McpUserContext } from "./utils/types.js";

const SERVER_NAME = "turboplan-catalog";
const SERVER_VERSION = "0.1.0";

type StorageConfig = {
  publicUrl: string;
};

export const createServer = (user: McpUserContext, storage: StorageConfig) => {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  server.registerTool(
    "ping",
    {
      description:
        "Health check. Returns server status and your identity. Use get_my_permissions for detailed access info.",
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "ok",
              server: SERVER_NAME,
              version: SERVER_VERSION,
              user: {
                userId: user.userId,
                actor: user.actor,
                role: user.userRole ?? "none",
              },
              hint: "Call get_my_permissions to see what you can access.",
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  registerOrganizationTools(server, user);
  registerOfficeTools(server, user);
  registerProjectTools(server, user);
  registerFieldTools(server, user);
  registerContextTools(server, user);
  registerMilestoneTools(server, user);
  registerTaskTools(server, user);
  registerTimelineTools(server, user);
  registerDocumentTools(server, user, storage);
  registerCoverImageTools(server, user);
  registerMemberTools(server, user);
  registerCommentTools(server, user);
  registerSummaryTools(server, user);
  registerCapabilityTools(server, user);

  return server;
};
