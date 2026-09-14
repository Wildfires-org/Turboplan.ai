import type { ReactNode } from "react";

import {
  ProjectPageHeader,
  type ProjectPageHeaderProps,
} from "./project-page-header";

interface ProjectPageWithHeaderProps extends ProjectPageHeaderProps {
  children: ReactNode;
}

export function ProjectPageWithHeader({
  children,
  ...headerProps
}: ProjectPageWithHeaderProps) {
  return (
    // `relative` = positioning context for the absolute full-bleed cover.
    <div className="relative flex flex-1 flex-col">
      <ProjectPageHeader {...headerProps} />
      {/* z-10 lifts ALL page content above the cover so it isn't hidden behind it. */}
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </div>
  );
}
