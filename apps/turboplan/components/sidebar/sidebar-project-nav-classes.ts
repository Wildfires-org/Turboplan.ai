// Project sub-nav recipes shared by the nav rows and the chat row.

/** Guide line under the project badge: badge centre is 24px from the menu
 * item edge (p-3 + half of size-6), so the 1px border sits at 24px. */
export const PROJECT_NAV_SUB_CLASS =
  "ml-6 mr-0 mt-0.5 translate-x-0 gap-0.5 border-l border-slate-900/[0.09] py-0 pl-2 pr-0";

/** Active row paints its own segment of the guide line. */
export const PROJECT_NAV_SUB_ITEM_CLASS =
  "relative before:pointer-events-none before:absolute before:inset-y-2 before:-left-2.5 before:w-[3px] before:rounded-full before:bg-transparent before:transition-colors before:duration-200 data-[active=true]:before:bg-slate-400 motion-reduce:before:transition-none";

/** Nav pill: quiet neutral fill when active, faint neutral hover. */
export const PROJECT_NAV_SUB_BUTTON_CLASS =
  "h-10 translate-x-0 rounded-lg px-3 text-gray-550 transition-colors hover:bg-slate-900/[0.04] hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-slate-400 focus-visible:ring-0 [&>svg]:text-current data-[active=true]:bg-slate-900/[0.07] data-[active=true]:font-medium data-[active=true]:text-slate-900 data-[active=true]:hover:bg-slate-900/[0.07] data-[active=true]:hover:text-slate-900";
