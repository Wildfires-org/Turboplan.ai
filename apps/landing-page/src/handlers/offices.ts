import { getLandingPageEnv } from "@wildfires-org/turboplan-env";
import type { PublicOfficeWithOrg } from "@wildfires-org/turboplan-public/types";

export async function getOffice(
  orgSlug: string,
  officeSlug: string,
): Promise<PublicOfficeWithOrg | null> {
  const { SERVER_URL } = getLandingPageEnv();

  try {
    const response = await fetch(
      `${SERVER_URL}/api/public/offices/${orgSlug}/${officeSlug}`,
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
