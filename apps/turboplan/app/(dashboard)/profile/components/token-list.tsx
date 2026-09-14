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
  Badge,
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
): { label: string; variant: "default" | "destructive" | "secondary" } => {
  if (token.revokedAt) {
    return { label: "Revoked", variant: "destructive" };
  }
  if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
    return { label: "Expired", variant: "secondary" };
  }
  return { label: "Active", variant: "default" };
};

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
      <div className="flex items-center justify-center rounded-lg border border-dashed py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <KeyRound className="size-10 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">
          No access tokens created yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
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
                <TableCell className="text-muted-foreground">
                  {token.actor}
                </TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {token.tokenPrefix}...
                  </code>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(token.createdAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(token.lastUsedAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(token.expiresAt)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={status.variant}
                    className={cn(
                      status.label === "Active" &&
                        "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400",
                      status.label === "Expired" &&
                        "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400",
                    )}
                  >
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isInactive || isRevoking}
                        className={cn(
                          "text-destructive hover:text-destructive",
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
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRevoke(token.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
