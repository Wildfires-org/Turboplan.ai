import {
  type ReadOnlyField,
  ReadOnlyFieldsRenderer,
} from "@wildfires-org/turboplan-fields/client";

interface PublicFieldsSectionProps {
  fields: ReadOnlyField[];
}

export function PublicFieldsSection({ fields }: PublicFieldsSectionProps) {
  return (
    <ReadOnlyFieldsRenderer
      fields={fields}
      variant="card"
      emptyMessage="This template doesn't have any custom fields defined yet."
    />
  );
}
