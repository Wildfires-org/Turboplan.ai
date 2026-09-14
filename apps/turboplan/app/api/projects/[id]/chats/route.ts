import { NextRequest, NextResponse } from "next/server";

import { getChatsByProjectId } from "@wildfires-org/turboplan-db/queries";
import { checkUserProjectAccess } from "@wildfires-org/turboplan-workspace/server";

import { auth } from "@/app/(auth)/auth";
import { createErrorResponse, ErrorResponses } from "@/lib/api/utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const resolvedParams = await params;

    if (!session?.user?.id) {
      return ErrorResponses.unauthorized();
    }

    // Check if user has access to this project
    const hasAccess = await checkUserProjectAccess(
      session.user.id,
      resolvedParams.id,
    );
    if (!hasAccess) {
      return ErrorResponses.forbidden("Access denied to this project");
    }

    const projectChats = await getChatsByProjectId({
      projectId: resolvedParams.id,
      limit: 50,
      offset: 0,
    });

    return NextResponse.json(projectChats);
  } catch (error) {
    console.error("Error fetching project chats:", error);
    return createErrorResponse("Failed to fetch project chats", 500);
  }
}
