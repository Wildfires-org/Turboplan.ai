"use client";

import { usePathname } from "next/navigation";

import { useLayoutSpacing } from "@/hooks/useLayoutSpacing";
import { cn } from "@/lib/utils";

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const { layoutClasses } = useLayoutSpacing();
  const pathname = usePathname();

  // Home and /docs are full-bleed. The landing sections manage their own
  // max-width and padding; the Fumadocs DocsLayout needs full width for its
  // sidebar + content + TOC columns, not the padded max-w-3xl container.
  if (
    pathname === "/" ||
    pathname === "/docs" ||
    pathname.startsWith("/docs/")
  ) {
    return <div className="flex w-full flex-col">{children}</div>;
  }

  return (
    <div
      className={cn(
        "flex w-screen 2xl:max-w-3xl px-5 lg:px-10 xl:px-[100px] 3xl:max-w-3xl justify-center flex-col",
        layoutClasses,
      )}
    >
      {children}
    </div>
  );
}
