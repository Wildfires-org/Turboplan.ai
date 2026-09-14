import { NextRequest } from "next/server";

import { getChatsByUserId } from "@wildfires-org/turboplan-db/queries";

import { auth } from "@/app/(auth)/auth";
import { ErrorResponses } from "@/lib/api/utils";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const limit = parseInt(searchParams.get("limit") || "10");
  const startingAfter = searchParams.get("starting_after");
  const endingBefore = searchParams.get("ending_before");

  if (startingAfter && endingBefore) {
    return ErrorResponses.badRequest(
      "Only one of starting_after or ending_before can be provided!",
    );
  }

  const session = await auth();

  if (!session?.user?.id) {
    return ErrorResponses.unauthorized();
  }

  try {
    const chats = await getChatsByUserId({
      id: session.user.id,
      limit,
      startingAfter,
      endingBefore,
    });

    return Response.json(chats);
  } catch (_) {
    return ErrorResponses.internalServerError("Failed to fetch chats!");
  }
}
