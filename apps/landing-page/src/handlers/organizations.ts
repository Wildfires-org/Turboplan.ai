import { getLandingPageEnv } from "@wildfires-org/turboplan-env";
import type { PublicOrganization } from "@wildfires-org/turboplan-public/types";

export async function getOrganization(
  slug: string,
): Promise<PublicOrganization | null> {
  const { SERVER_URL } = getLandingPageEnv();

  try {
    const response = await fetch(
      `${SERVER_URL}/api/public/organizations/${slug}`,
      {
        next: { revalidate: 60 },
      },
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}
