import useSWRMutation from "swr/mutation";

import { ApiClient } from "@wildfires-org/turboplan-api-client";

const apiClient = new ApiClient();

type OfficeStatus = "active" | "archived";

const updateOfficeStatusFetcher = async (
  _key: string,
  { arg }: { arg: { officeId: string; status: OfficeStatus } },
) => {
  const { data, error } = await apiClient.put(`/api/offices/${arg.officeId}`, {
    status: arg.status,
  });

  if (error) {
    throw new Error(error || `Failed to set office to ${arg.status}`);
  }

  return data;
};

export function useOfficeStatus(status: OfficeStatus) {
  const { trigger, isMutating } = useSWRMutation(
    "/api/offices",
    updateOfficeStatusFetcher,
  );

  const updateOfficeStatus = (officeId: string) =>
    trigger({ officeId, status });

  return { updateOfficeStatus, isUpdatingOfficeStatus: isMutating };
}
