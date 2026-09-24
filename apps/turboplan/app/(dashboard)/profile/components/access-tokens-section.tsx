"use client";

import { PANEL_CLASS, PANEL_TITLE_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { CreateTokenDialog } from "./create-token-dialog";
import { TokenList } from "./token-list";

export const AccessTokensSection = () => (
  <section
    aria-labelledby="access-tokens-title"
    className={cn(PANEL_CLASS, "space-y-4")}
  >
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div>
        <h2 id="access-tokens-title" className={PANEL_TITLE_CLASS}>
          Access tokens
        </h2>
        <p className="mt-1 max-w-xl text-[13px] leading-5 text-gray-550">
          Personal access tokens allow external services and integrations to
          authenticate with TurboPlan on your behalf.
        </p>
      </div>
      <CreateTokenDialog />
    </div>
    <TokenList />
  </section>
);
