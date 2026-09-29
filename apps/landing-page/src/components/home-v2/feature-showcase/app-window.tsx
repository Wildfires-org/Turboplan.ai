import {
  ArrowLeft,
  Clock,
  Eye,
  File as FileIcon,
  LayoutDashboard,
  ListChecks,
  Map as MapIcon,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  Plus,
  Users,
} from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";
import type { ModuleKey } from "./types";

// ---------------------------------------------------------------------------
// App-window chrome — every slide is framed as the real turboplan window:
// a narrow left icon rail + a breadcrumb bar + the module content.
// ---------------------------------------------------------------------------

const RAIL_MODULES: { key: ModuleKey; Icon: typeof MapIcon }[] = [
  { key: "overview", Icon: LayoutDashboard },
  { key: "chat", Icon: MessageSquare },
  { key: "map", Icon: MapIcon },
  { key: "tasks", Icon: ListChecks },
  { key: "timeline", Icon: Clock },
  { key: "comments", Icon: MessageCircle },
  { key: "documents", Icon: FileIcon },
  { key: "members", Icon: Users },
];

function AppRail({ active }: { active: ModuleKey }) {
  return (
    <div className="flex w-[52px] shrink-0 flex-col items-center gap-1.5 border-r border-white/70 bg-white/40 pb-2.5 pt-1.5">
      <span className="mb-1 flex size-8 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-egray-100">
        <Image
          src="/images/beaver_right.png"
          alt=""
          width={32}
          height={32}
          className="size-7 object-cover object-top"
        />
      </span>
      <span className="flex size-8 items-center justify-center rounded-lg bg-brandAlt-400 font-heading text-[10px] font-bold text-white">
        GO
      </span>
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-800 text-white">
        <Plus className="size-4" strokeWidth={2.5} />
      </span>
      <span className="flex size-8 items-center justify-center rounded-lg text-egray-400">
        <ArrowLeft className="size-4" />
      </span>
      <span className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-brandAlt-400 font-heading text-[10px] font-bold text-white ring-2 ring-brandAlt-200">
        CT
      </span>
      <span className="my-0.5 h-px w-6 bg-egray-100" />
      {RAIL_MODULES.map(({ key, Icon }) => (
        <span
          key={key}
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            active === key
              ? "bg-brandAlt-100 text-brand-800"
              : "text-egray-400",
          )}
        >
          <Icon className="size-4" />
        </span>
      ))}
    </div>
  );
}

// Breadcrumb bar — polished, plausible agency hierarchy (org / office / project
// / module), styled like the hero preview. When `crumb` is omitted the project
// name itself is the bold final crumb (overview), never duplicated.
function AppTopBar({ crumb }: { crumb?: string }) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-egray-100/80 bg-white/60 px-4 font-inter text-[12px] leading-none">
      <span className="shrink-0 text-egray-500">USDA Forest Service</span>
      <span className="text-egray-300">/</span>
      <span className="hidden shrink-0 text-egray-500 sm:inline">
        Tahoe Ranger District
      </span>
      <span className="hidden text-egray-300 sm:inline">/</span>
      {crumb ? (
        <>
          <span className="hidden shrink-0 text-egray-500 md:inline">
            Canyon Three Fuels Reduction
          </span>
          <span className="hidden text-egray-300 md:inline">/</span>
          <span className="truncate font-medium text-neutral-black">
            {crumb}
          </span>
        </>
      ) : (
        <span className="truncate font-medium text-neutral-black">
          Canyon Three Fuels Reduction
        </span>
      )}
    </div>
  );
}

export function AppWindow({
  crumb,
  active,
  children,
  contentClassName,
}: {
  crumb?: string;
  active: ModuleKey;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="flex h-full w-full overflow-hidden rounded-2xl border border-white/85 bg-white/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <AppRail active={active} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopBar crumb={crumb} />
        <div className={cn("min-h-0 flex-1 overflow-hidden", contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function SquareAvatar({
  initials,
  className,
}: {
  initials: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-egray-75 font-heading text-[11px] font-semibold text-egray-700",
        className,
      )}
    >
      {initials}
    </span>
  );
}
