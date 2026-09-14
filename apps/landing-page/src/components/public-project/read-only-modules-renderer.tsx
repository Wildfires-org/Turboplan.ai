import { Fragment, type ReactNode } from "react";

interface ReadOnlyModuleEntry {
  id: string;
  isHidden?: boolean;
  render: () => ReactNode;
}

interface ReadOnlyModulesRendererProps {
  moduleOrder: string[];
  entries: ReadOnlyModuleEntry[];
}

export function ReadOnlyModulesRenderer({
  moduleOrder,
  entries,
}: ReadOnlyModulesRendererProps) {
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));

  return (
    <div className="space-y-6">
      {moduleOrder.map((moduleId) => {
        const entry = entriesById.get(moduleId);
        if (!entry || entry.isHidden) {
          return null;
        }

        return <Fragment key={moduleId}>{entry.render()}</Fragment>;
      })}
    </div>
  );
}
