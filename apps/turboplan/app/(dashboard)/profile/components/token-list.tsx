"use client";

import { KeyRound, Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  cn,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wildfires-org/turboplan-utils";

import type { AccessToken } from "@/hooks/use-access-tokens";
import { useAccessTokens, useRevokeToken } from "@/hooks/use-access-tokens";
import {
  CHIP_BASE_CLASS,
  CHIP_TONE_CLASS,
  type ChipTone,
  DESTRUCTIVE_BUTTON_CLASS,
  EMPTY_STATE_TEXT_CLASS,
  EMPTY_STATE_TITLE_CLASS,
} from "@/lib/glass";

const formatDate = (dateString: string | null) => {
  if (!dateString) {
    return "Never";
  }
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getTokenStatus = (
  token: AccessToken,
): { label: string; tone: ChipTone } => {
  if (token.revokedAt) {
    return { label: "Revoked", tone: "danger" };
  }
  if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
    return { label: "Expired", tone: "neutral" };
  }
  return { label: "Active", tone: "brand" };
};

/** Inset white well the list states sit in (same box for loading/empty). */
const TOKEN_STATE_CLASS =
  "flex flex-col items-center justify-center rounded-xl bg-white/60 py-12 text-center ring-1 ring-inset ring-slate-900/[0.06] dark:bg-white/5";

export const TokenList = () => {
  const { tokens, isLoading, mutate } = useAccessTokens();
  const { revokeToken, isRevoking } = useRevokeToken(() => {
    mutate();
  });

  const handleRevoke = async (tokenId: string) => {
    await revokeToken(tokenId);
  };

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading tokens"
        className={TOKEN_STATE_CLASS}
      >
        <Loader2 className="size-6 animate-spin text-brand-800" />
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className={TOKEN_STATE_CLASS}>
        <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-800/15">
          <KeyRound aria-hidden className="size-5" />
        </span>
        <p className={cn(EMPTY_STATE_TITLE_CLASS, "mt-3")}>
          No access tokens yet
        </p>
        <p className={EMPTY_STATE_TEXT_CLASS}>
          Create one to connect an integration.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-slate-900/[0.06] dark:bg-slate-900 dark:ring-white/10">
      <Table className="whitespace-nowrap">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Prefix</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last Used</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tokens.map((token) => {
            const status = getTokenStatus(token);
            const isInactive = !!token.revokedAt || status.label === "Expired";

            return (
              <TableRow key={token.id}>
                <TableCell className="font-medium">{token.name}</TableCell>
                <TableCell className="text-gray-550">{token.actor}</TableCell>
                <TableCell>
                  <code className="rounded-md bg-slate-900/[0.04] px-1.5 py-0.5 text-xs text-foreground ring-1 ring-inset ring-slate-900/[0.06]">
                    {token.tokenPrefix}...
                  </code>
                </TableCell>
                <TableCell className="text-gray-550">
                  {formatDate(token.createdAt)}
                </TableCell>
                <TableCell className="text-gray-550">
                  {formatDate(token.lastUsedAt)}
                </TableCell>
                <TableCell className="text-gray-550">
                  {formatDate(token.expiresAt)}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      CHIP_BASE_CLASS,
                      CHIP_TONE_CLASS[status.tone],
                    )}
                  >
                    {status.label}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isInactive || isRevoking}
                        className={cn(
                          "rounded-lg text-error-700 hover:bg-error-50 hover:text-error-800",
                          isRevoking && "pointer-events-none",
                        )}
                      >
                        {isRevoking ? (
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        ) : null}
                        Revoke
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke access token</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to revoke the token{" "}
                          <span className="font-medium text-foreground">
                            {token.name}
                          </span>
                          ? Any integrations using this token will immediately
                          lose access.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2 sm:space-x-0">
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRevoke(token.id)}
                          className={DESTRUCTIVE_BUTTON_CLASS}
                        >
                          Revoke
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
