// Project sub-nav recipes shared by the nav rows and the chat row.

/** Guide line under the project badge: badge centre is 24px from the menu
 * item edge (p-3 + half of size-6), so the 1px border sits at 24px. */
export const PROJECT_NAV_SUB_CLASS =
  "ml-6 mr-0 mt-0.5 translate-x-0 gap-0.5 border-l border-slate-900/[0.09] py-0 pl-2 pr-0";

/** Active row paints its own segment of the guide line in brand-800. */
export const PROJECT_NAV_SUB_ITEM_CLASS =
  "relative before:pointer-events-none before:absolute before:inset-y-2 before:-left-2.5 before:w-[3px] before:rounded-full before:bg-transparent before:transition-colors before:duration-200 data-[active=true]:before:bg-brand-800 motion-reduce:before:transition-none";

/** Nav pill: brand-800 fill when active (white text 4.6:1), mint hover. */
export const PROJECT_NAV_SUB_BUTTON_CLASS =
  "h-10 translate-x-0 rounded-lg px-3 text-gray-550 transition-colors hover:bg-brandAlt-100 hover:text-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-700 focus-visible:ring-0 [&>svg]:text-current data-[active=true]:bg-brand-800 data-[active=true]:text-white data-[active=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] data-[active=true]:hover:bg-brand-800 data-[active=true]:hover:text-white";
