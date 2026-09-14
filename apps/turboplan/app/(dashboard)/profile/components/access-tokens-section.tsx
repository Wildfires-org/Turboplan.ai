"use client";

import { CreateTokenDialog } from "./create-token-dialog";
import { TokenList } from "./token-list";

export const AccessTokensSection = () => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-medium">Access Tokens</h2>
        <p className="text-sm text-muted-foreground">
          Personal access tokens allow external services and integrations to
          authenticate with TurboPlan on your behalf.
        </p>
      </div>
      <CreateTokenDialog />
    </div>
    <TokenList />
  </div>
);
