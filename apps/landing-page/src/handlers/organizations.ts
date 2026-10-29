import type { PublicOrganization } from "@wildfires-org/turboplan-public/types";

import { getPublicEntity } from "./public-entity";

export const getOrganization = (slug: string) =>
  getPublicEntity<PublicOrganization>(`organizations/${slug}`);
