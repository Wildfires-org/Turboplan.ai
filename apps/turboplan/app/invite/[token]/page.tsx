"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Building2,
  CheckCircle,
  FolderKanban,
  Loader2,
  Mail,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";

import { ApiClient, publicFetcher } from "@wildfires-org/turboplan-api-client";
import { useSession } from "@wildfires-org/turboplan-auth/client";
import { Button } from "@wildfires-org/turboplan-utils";

import { acceptInvitationWithAutoSignup } from "./actions";
import { buildInviteLoginUrl } from "./login-url";

type InvitationStatus =
  | "loading"
  | "valid"
  | "expired"
  | "accepted"
  | "revoked"
  | "not_found"
  | "error";

type InvitationApiStatus = "pending" | "accepted" | "expired" | "revoked";

interface InvitationDetails {
  email: string;
  role: string;
  entityType: "organization" | "office" | "project";
  entityName: string;
  inviterName: string;
  status: InvitationApiStatus;
  expiresAt: string;
}

const apiClient = new ApiClient();

type PublicFetcherError = Error & { status?: number; info?: string };

const entityIcons = {
  organization: Building2,
  office: Building2,
  project: FolderKanban,
};

const entityLabels = {
  organization: "Organization",
  office: "Office",
  project: "Project",
};

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const session = useSession();
  const rawToken = params.token;
  const token =
    typeof rawToken === "string"
      ? rawToken
      : Array.isArray(rawToken)
        ? (rawToken[0] ?? "")
        : "";

  const [statusOverride, setStatusOverride] = useState<InvitationStatus | null>(
    null,
  );
  const [actionErrorMessage, setActionErrorMessage] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);

  const {
    data: invitation,
    error,
    isLoading,
    mutate,
  } = useSWR<InvitationDetails>(
    token ? `/api/public/invitations/${token}` : null,
    publicFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  useEffect(() => {
    setStatusOverride(null);
    setActionErrorMessage("");
    setIsAccepting(false);
  }, [token]);

  const derived = useMemo((): {
    status: InvitationStatus;
    errorMessage: string;
  } => {
    if (!token) {
      return {
        status: "not_found",
        errorMessage: "This invitation link is invalid or has been removed.",
      };
    }

    if (isLoading) {
      return { status: "loading", errorMessage: "" };
    }

    if (error) {
      const status = (error as PublicFetcherError).status;
      if (status === 404) {
        return {
          status: "not_found",
          errorMessage: "This invitation link is invalid or has been removed.",
        };
      }

      return {
        status: "error",
        errorMessage: "Something went wrong. Please try again.",
      };
    }

    if (!invitation) {
      return {
        status: "error",
        errorMessage: "Something went wrong. Please try again.",
      };
    }

    if (invitation.status === "accepted") {
      return { status: "accepted", errorMessage: "" };
    }

    if (invitation.status === "revoked") {
      return {
        status: "revoked",
        errorMessage: "This invitation has been revoked.",
      };
    }

    const expiresAt = new Date(invitation.expiresAt);
    const isExpired =
      invitation.status === "expired" ||
      (Number.isFinite(expiresAt.getTime()) && expiresAt < new Date());

    if (isExpired) {
      return {
        status: "expired",
        errorMessage: "This invitation has expired.",
      };
    }

    return { status: "valid", errorMessage: "" };
  }, [error, invitation, isLoading, token]);

  const pageStatus = statusOverride ?? derived.status;
  const errorMessage =
    statusOverride === "expired"
      ? actionErrorMessage || derived.errorMessage
      : derived.errorMessage;

  // Handle accept for unauthenticated users - auto signup flow
  const handleAutoSignupAccept = async () => {
    setIsAccepting(true);
    setActionErrorMessage("");

    try {
      const result = await acceptInvitationWithAutoSignup(token);

      if (
        (result.status === "success" || result.status === "login_required") &&
        result.redirectTo
      ) {
        router.push(result.redirectTo);
        return;
      }

      if (result.status === "already_accepted") {
        setStatusOverride("accepted");
        await mutate(
          (current) => (current ? { ...current, status: "accepted" } : current),
          { revalidate: false },
        );
        setIsAccepting(false);
        return;
      }

      if (result.status === "expired") {
        setStatusOverride("expired");
        setActionErrorMessage(result.error || "This invitation has expired.");
        setIsAccepting(false);
        return;
      }

      // Other errors
      setActionErrorMessage(result.error || "Failed to accept invitation");
      setIsAccepting(false);
    } catch (error) {
      console.error("Error accepting invitation:", error);
      setActionErrorMessage("Failed to accept invitation. Please try again.");
      setIsAccepting(false);
    }
  };

  // Handle accept for authenticated users - API call flow
  const handleAuthenticatedAccept = async () => {
    setIsAccepting(true);
    setActionErrorMessage("");

    try {
      const { data, error } = await apiClient.post<{
        success: boolean;
        entityType: string;
        entityId: string;
        role: string;
      }>("/api/invitations/accept", {
        token,
      });

      if (error || !data) {
        setActionErrorMessage(error || "Failed to accept invitation");
        setIsAccepting(false);
        return;
      }

      // Success - redirect to dashboard
      router.push("/");
    } catch (error) {
      console.error("Error accepting invitation:", error);
      setActionErrorMessage("Failed to accept invitation. Please try again.");
      setIsAccepting(false);
    }
  };

  const signedInEmail = session?.user?.email ?? null;
  // Acceptance is bound to the invited address server-side; mirror that here
  // so a different account is not offered a button that can only fail.
  const isWrongAccount =
    !!signedInEmail &&
    !!invitation?.email &&
    signedInEmail.trim().toLowerCase() !==
      invitation.email.trim().toLowerCase();
  const switchAccountHref = `/logout?callbackUrl=${encodeURIComponent(
    buildInviteLoginUrl(token, invitation?.email),
  )}`;

  const EntityIcon = invitation
    ? entityIcons[invitation.entityType]
    : Building2;

  // Loading state
  if (pageStatus === "loading") {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
  }

  // Error states
  if (
    pageStatus === "not_found" ||
    pageStatus === "error" ||
    pageStatus === "expired" ||
    pageStatus === "revoked"
  ) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-background">
        <div className="w-full max-w-md p-8 flex flex-col items-center gap-6 text-center">
          <div className="flex items-center justify-center size-16 rounded-full bg-red-100 dark:bg-red-900/20">
            <XCircle className="size-8 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold mb-2">
              {pageStatus === "not_found" && "Invitation Not Found"}
              {pageStatus === "expired" && "Invitation Expired"}
              {pageStatus === "revoked" && "Invitation Revoked"}
              {pageStatus === "error" && "Something Went Wrong"}
            </h1>
            <p className="text-muted-foreground">{errorMessage}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/">Go to Dashboard</Link>
            </Button>
            {(pageStatus === "expired" || pageStatus === "revoked") && (
              <Button variant="outline" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Already accepted
  if (pageStatus === "accepted") {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-background">
        <div className="w-full max-w-md p-8 flex flex-col items-center gap-6 text-center">
          <div className="flex items-center justify-center size-16 rounded-full bg-green-100 dark:bg-green-900/20">
            <CheckCircle className="size-8 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold mb-2">
              Invitation Already Accepted
            </h1>
            <p className="text-muted-foreground">
              This invitation has already been accepted.
            </p>
          </div>
          <Button asChild>
            <Link href="/">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Valid invitation - show details and accept button
  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 flex flex-col items-center gap-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center size-16 rounded-full bg-primary/10 mb-4 mx-auto">
            <Mail className="size-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">
            You&apos;ve Been Invited!
          </h1>
          <p className="text-muted-foreground">
            {invitation?.inviterName} has invited you to join their{" "}
            {entityLabels[
              invitation?.entityType || "organization"
            ].toLowerCase()}
            .
          </p>
        </div>

        {/* Invitation Details Card */}
        <div className="w-full border rounded-lg p-6 space-y-4 bg-card">
          {/* Entity Info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-muted">
              <EntityIcon className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {entityLabels[invitation?.entityType || "organization"]}
              </p>
              <p className="font-medium">{invitation?.entityName}</p>
            </div>
          </div>

          {/* Inviter */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-muted">
              <User className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Invited by
              </p>
              <p className="font-medium">{invitation?.inviterName}</p>
            </div>
          </div>

          {/* Role */}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">Your role</span>
            <span className="text-sm font-medium capitalize">
              {invitation?.role}
            </span>
          </div>
        </div>

        {/* Error message */}
        {actionErrorMessage && (
          <p className="text-sm text-red-600 dark:text-red-400 text-center">
            {actionErrorMessage}
          </p>
        )}

        {/* Action Buttons */}
        <div className="w-full space-y-3">
          {session?.user && isWrongAccount ? (
            <>
              <p className="text-sm text-center text-muted-foreground">
                This invitation is for{" "}
                <span className="font-medium text-foreground">
                  {invitation?.email}
                </span>
                , but you are signed in as{" "}
                <span className="font-medium text-foreground">
                  {signedInEmail}
                </span>
                . Sign in with the invited account to accept it.
              </p>
              <Button asChild className="w-full" size="lg">
                {/* Plain anchor: a full navigation, never prefetched. */}
                <a href={switchAccountHref}>Sign in as {invitation?.email}</a>
              </Button>
            </>
          ) : session?.user ? (
            <>
              <Button
                onClick={handleAuthenticatedAccept}
                disabled={isAccepting}
                className="w-full"
                size="lg"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  "Accept Invitation"
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Signed in as {session.user.email}
              </p>
            </>
          ) : (
            <>
              <Button
                onClick={handleAutoSignupAccept}
                disabled={isAccepting}
                className="w-full"
                size="lg"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Accept Invitation"
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                An account will be created for {invitation?.email}
              </p>
            </>
          )}
        </div>

        {/* Footer note */}
        {invitation?.email && (
          <p className="text-xs text-center text-muted-foreground">
            This invitation was sent to {invitation.email}
          </p>
        )}
      </div>
    </div>
  );
}
