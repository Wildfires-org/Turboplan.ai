import { useMemo } from "react";

import useSWR from "swr";

import { getLandingPageEnv } from "@wildfires-org/turboplan-env";

import { fetcher } from "@/lib/utils";
import type { PublicProject } from "@/types/public-project";

const { SERVER_URL } = getLandingPageEnv();

interface UseTemplatesOptions {
  organizationId?: string;
  organizationSlug?: string;
  officeId?: string;
  officeSlug?: string;
  limit?: number;
}

type TemplatesResponse = {
  templates: PublicProject[];
  hasMore: boolean;
};

export function useTemplates(options: UseTemplatesOptions = {}) {
  const { organizationId, organizationSlug, officeId, officeSlug, limit } =
    options;

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (organizationId) params.set("organizationId", organizationId);
    if (organizationSlug) params.set("organizationSlug", organizationSlug);
    if (officeId) params.set("officeId", officeId);
    if (officeSlug) params.set("officeSlug", officeSlug);
    if (limit) params.set("limit", String(limit));
    const query = params.toString();
    return `${SERVER_URL}/api/public/templates${query ? `?${query}` : ""}`;
  }, [organizationId, organizationSlug, officeId, officeSlug, limit]);

  return useSWR<TemplatesResponse>(apiUrl, fetcher);
}
