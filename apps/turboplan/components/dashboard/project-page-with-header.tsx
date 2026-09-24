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
    <div className="relative isolate flex flex-1 flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse at 4% 40%, rgba(164, 206, 190, 0.38), transparent 40%), radial-gradient(ellipse at 96% 24%, rgba(209, 230, 222, 0.5), transparent 38%), radial-gradient(ellipse at 52% 82%, rgba(96, 222, 174, 0.12), transparent 42%), linear-gradient(180deg, rgba(244, 249, 247, 0.48) 0%, rgba(244, 249, 247, 0.8) 220px, rgba(244, 249, 247, 0.98) 430px, #f4f9f7 620px)",
        }}
      />
      <ProjectPageHeader {...headerProps} />
      {/* z-10 lifts ALL page content above the cover so it isn't hidden behind it. */}
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </div>
  );
}
