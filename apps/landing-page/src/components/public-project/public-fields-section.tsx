import {
  type ReadOnlyField,
  ReadOnlyFieldsRenderer,
} from "@wildfires-org/turboplan-fields/client";

import { PublicEmptyState } from "./public-empty-state";

interface PublicFieldsSectionProps {
  fields: ReadOnlyField[];
  entity: "project" | "template";
}

export function PublicFieldsSection({
  fields,
  entity,
}: PublicFieldsSectionProps) {
  if (fields.length === 0) {
    return (
      <PublicEmptyState
        title="No fields yet"
        message={`This ${entity} doesn't have any custom fields defined yet.`}
      />
    );
  }

  return <ReadOnlyFieldsRenderer fields={fields} variant="card" />;
}
