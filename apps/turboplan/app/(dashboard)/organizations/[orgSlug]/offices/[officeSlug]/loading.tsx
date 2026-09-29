import { InertLoading } from "@/components/dashboard/inert-loading";
import { OfficeRouteLoading } from "@/components/dashboard/office-route-loading";

export default function OfficeLoading() {
  return (
    <InertLoading>
      <OfficeRouteLoading />
    </InertLoading>
  );
}
