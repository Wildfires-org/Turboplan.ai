import { SKELETON_BAR_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { ProfilePageFrame } from "./components/profile-page-frame";

/** Same frame, tab track and panel as the profile page, so nothing moves
 * when it lands. Segment widths match the three real tabs. */
export default function ProfileLoading() {
  return (
    <ProfilePageFrame>
      <div aria-busy="true" className="flex flex-col gap-4">
        <div className="glass flex h-10 w-fit items-center gap-1 self-start rounded-full p-1">
          {["w-[92px]", "w-[141px]", "w-[126px]"].map((width) => (
            <span
              key={width}
              className={cn(SKELETON_BAR_CLASS, "h-8 rounded-full", width)}
            />
          ))}
        </div>
        <div className="glass-card h-[640px] rounded-[20px] p-4 sm:p-5">
          <div className="flex h-6 items-center">
            <div className={cn(SKELETON_BAR_CLASS, "h-4 w-40")} />
          </div>
          <div className="mt-4 flex items-center gap-4 border-t border-slate-900/[0.06] py-5">
            <div className={cn(SKELETON_BAR_CLASS, "size-20 rounded-full")} />
            <div className="flex flex-1 flex-col gap-2">
              <div className={cn(SKELETON_BAR_CLASS, "h-4 w-28")} />
              <div className={cn(SKELETON_BAR_CLASS, "h-3 w-64 max-w-full")} />
            </div>
          </div>
        </div>
      </div>
    </ProfilePageFrame>
  );
}
