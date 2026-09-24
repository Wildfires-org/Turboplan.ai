import type { ReactNode } from "react";

interface InertLoadingProps {
  children: ReactNode;
}

/**
 * Route loading states render the real page chrome (headers, action buttons,
 * menus) so nothing shifts when the page arrives. That chrome must not be
 * interactive: a dialog opened from a loading fallback unmounts together with
 * it the moment the real page streams in. `inert` keeps it visually identical
 * but unclickable and unfocusable; `contents` keeps it out of the layout.
 */
export const InertLoading = ({ children }: InertLoadingProps) => {
  return (
    <div inert aria-busy="true" className="contents">
      {children}
    </div>
  );
};
