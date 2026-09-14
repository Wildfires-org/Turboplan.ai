"use client";

import { usePathname } from "next/navigation";

import { routing } from "@/utils/routing";

type LayoutConfig = {
  withOrgHeader: boolean;
  withMainHeader: boolean;
};

export const useLayoutSpacing = () => {
  const pathname = usePathname();

  const getLayoutConfig = (): LayoutConfig => {
    return {
      withOrgHeader: pathname.includes(routing.catalog()),
      withMainHeader: true,
    };
  };

  const config = getLayoutConfig();

  // The sticky navbar sits in normal document flow, so pages no longer
  // need a fixed-header offset — only catalog routes keep the extra
  // spacing for the org-select header area.
  const getLayoutClasses = () => {
    if (!config.withOrgHeader) {
      return "";
    }

    return "mt-org-select-header-mobile lg:mt-org-select-header-desktop";
  };

  return {
    layoutClasses: getLayoutClasses(),
    ...config,
  };
};
