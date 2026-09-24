import {
  type ReadOnlyField,
  ReadOnlyFieldsRenderer,
} from "@wildfires-org/turboplan-fields/client";

interface PublicFieldsSectionProps {
  fields: ReadOnlyField[];
  entity: "project" | "template";
}

export function PublicFieldsSection({
  fields,
  entity,
}: PublicFieldsSectionProps) {
  return (
    <ReadOnlyFieldsRenderer
      fields={fields}
      variant="card"
      emptyMessage={`This ${entity} doesn't have any custom fields defined yet.`}
    />
  );
}
