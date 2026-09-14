import { getPrompt } from "@wildfires-org/turboplan-ai/services";
import { isLocalDevelopment } from "@wildfires-org/turboplan-env";
import {
  isMapPackageEnabled,
  isTasksPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";

import { auth } from "@/app/(auth)/auth";
import { ErrorResponses } from "@/lib/api/utils";

const PROMPT_MAP = {
  text: { creation: "text-document", update: "update-document-text" },
  code: { creation: "code", update: "update-document-code" },
  sheet: { creation: "sheet", update: "update-document-sheet" },
} as const;

type DocumentKind = keyof typeof PROMPT_MAP;

const isValidKind = (kind: string): kind is DocumentKind => {
  return kind in PROMPT_MAP;
};

const buildToolDescription = async () => {
  const [descBase, descTasks, descMap, descFooter] = await Promise.all([
    getPrompt("tool-desc-create-document"),
    getPrompt("tool-desc-create-document-tasks"),
    getPrompt("tool-desc-create-document-map"),
    getPrompt("tool-desc-create-document-footer"),
  ]);

  let description = descBase;
  if (isTasksPackageEnabled()) {
    description += descTasks;
  }
  if (isMapPackageEnabled()) {
    description += descMap;
  }
  description += descFooter;

  return description;
};

export const GET = async (request: Request) => {
  // Fail closed: local development only. `isLocalDevelopment()` requires BOTH
  // a non-production NODE_ENV and an APP_ENV that is not a deployed target, so
  // forgetting either variable still keeps this shut. Gating on
  // `getAppEnv() === "development"` alone made the route 404 everywhere
  // (APP_ENV is unset locally); `!== "production"` would fail OPEN instead.
  if (!isLocalDevelopment()) {
    return new Response("Not found", { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return ErrorResponses.unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") ?? "text";

  if (!isValidKind(kind)) {
    return ErrorResponses.badRequest(
      `Invalid kind "${kind}". Must be one of: ${Object.keys(PROMPT_MAP).join(", ")}`,
    );
  }

  const { creation, update } = PROMPT_MAP[kind];

  const [creationPrompt, updatePrompt, toolDescription] = await Promise.all([
    getPrompt(creation),
    getPrompt(update),
    buildToolDescription(),
  ]);

  return Response.json({ toolDescription, creationPrompt, updatePrompt });
};
