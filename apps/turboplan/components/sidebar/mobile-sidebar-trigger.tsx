"use client";

import { Menu } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";

/** Opens the sidebar sheet on phones, where the sidebar has no rail. */
export function MobileSidebarTrigger() {
  const { setOpenMobile } = useSidebar();

  return (
    <button
      type="button"
      onClick={() => setOpenMobile(true)}
      aria-label="Open navigation"
      className="-ml-1.5 flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-900/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 md:hidden"
    >
      <Menu className="size-5" />
    </button>
  );
}
