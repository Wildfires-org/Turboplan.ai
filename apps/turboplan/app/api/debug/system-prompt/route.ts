import { systemPrompt } from "@wildfires-org/turboplan-ai";
import { isLocalDevelopment } from "@wildfires-org/turboplan-env";

import { auth } from "@/app/(auth)/auth";
import { buildSystemPromptArgs } from "@/lib/ai/build-system-prompt-args";
import { ErrorResponses } from "@/lib/api/utils";

export async function GET(request: Request) {
  // Fail closed: local development only. `isLocalDevelopment()` requires BOTH
  // a non-production NODE_ENV and an APP_ENV that is not a deployed target, so
  // forgetting either variable still keeps this shut. Gating on
  // `getAppEnv() === "development"` alone made the route 404 everywhere
  // (APP_ENV is unset locally); `!== "production"` would fail OPEN instead and
  // expose arbitrary project context.
  if (!isLocalDevelopment()) {
    return new Response("Not found", { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return ErrorResponses.unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const chatId = searchParams.get("chatId") ?? undefined;

  const promptArgs = await buildSystemPromptArgs({
    projectId,
    chatId,
    userId: session.user.id,
  });
  const prompt = await systemPrompt(promptArgs);

  return Response.json({ prompt });
}
