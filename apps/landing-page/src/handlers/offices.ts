import type { PublicOfficeWithOrg } from "@wildfires-org/turboplan-public/types";

import { getPublicEntity } from "./public-entity";

export const getOffice = (orgSlug: string, officeSlug: string) =>
  getPublicEntity<PublicOfficeWithOrg>(`offices/${orgSlug}/${officeSlug}`);
