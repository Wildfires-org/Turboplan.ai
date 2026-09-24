/** Map-frame placeholder at the loaded map's height (min-h 400px) so the
 * section card keeps its size; soft pulse, static for reduced motion. */
export function MapLoadingView() {
  return (
    <div
      role="status"
      aria-label="Loading map"
      className="relative h-[400px] w-full overflow-hidden rounded-lg bg-brandAlt-200/70 animate-pulse motion-reduce:animate-none dark:bg-slate-800/70"
    >
      {/* Faint map-control hints: layer switcher + zoom stack. */}
      <span className="absolute right-3 top-3 h-8 w-28 rounded-lg bg-white/60 dark:bg-white/10" />
      <span className="absolute left-3 top-3 h-16 w-8 rounded-lg bg-white/60 dark:bg-white/10" />
    </div>
  );
}
