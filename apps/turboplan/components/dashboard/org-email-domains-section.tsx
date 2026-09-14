"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Check, Plus, X } from "lucide-react";
import useSWRMutation from "swr/mutation";

import { putFetcher } from "@wildfires-org/turboplan-api-client";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import { Button, cn, Skeleton } from "@wildfires-org/turboplan-utils";

import { toast } from "@/components/toast";

interface OrgEmailDomainsSectionProps {
  organizationId: string;
  initialDomains: string[];
  userId: string | undefined;
  /** Called after a successful save so the parent can refresh server data. */
  onSaved?: () => void;
  /**
   * Lets a host dialog register a callback it invokes on Escape. The callback
   * returns whether Escape should be swallowed (its inline add-domain input is
   * focused, so Escape closes that input rather than the dialog); registering
   * `null` clears it. Avoids the host reaching into this component's DOM.
   */
  onRegisterEscapeIntercept?: (fn: (() => boolean) | null) => void;
}

interface EmailDomainsResponse {
  emailDomains: string[];
}

const MAX_DOMAINS = 20;

// Loose client-side sanity check only. The server performs the authoritative
// normalization/validation (public provider rejection, etc.).
const DOMAIN_REGEX = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i;

const normalizeDomain = (value: string) => value.trim().toLowerCase();

const areSameDomains = (a: string[], b: string[]) => {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((domain, index) => domain === b[index]);
};

export function OrgEmailDomainsSection({
  organizationId,
  initialDomains,
  userId,
  onSaved,
  onRegisterEscapeIntercept,
}: OrgEmailDomainsSectionProps) {
  const { hasPermission: canEdit, isChecking } = useEntityPermission({
    userId,
    entityType: EntityType.ORGANIZATION,
    entityId: organizationId,
    action: Action.MANAGE_MEMBERS,
  });

  const [domains, setDomains] = useState<string[]>(initialDomains);
  // Baseline for the dirty check. Must track the LAST SAVED list, not the
  // `initialDomains` prop — the prop is a server-render snapshot that goes
  // stale after the first in-place save, which would wrongly disable Save
  // when the draft happens to drift back to the initial value.
  const [savedDomains, setSavedDomains] = useState<string[]>(initialDomains);
  const [inputValue, setInputValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { trigger, isMutating } = useSWRMutation(
    `/api/organizations/${organizationId}/email-domains`,
    putFetcher<EmailDomainsResponse>,
  );

  const isDirty = useMemo(
    () => !areSameDomains(domains, savedDomains),
    [domains, savedDomains],
  );

  const isAtCap = domains.length >= MAX_DOMAINS;

  const handleStartAdding = () => {
    if (isAtCap) {
      return;
    }
    setIsAdding(true);
  };

  const handleCancelAdding = useCallback(() => {
    setInputValue("");
    setIsAdding(false);
  }, []);

  // The host dialog can't preempt Radix's capture-phase Escape dismissal from
  // inside this component (see edit-organization-dialog's onEscapeKeyDown), so
  // we hand it a predicate: while the inline add-domain input is focused,
  // Escape should close that input, not the dialog. Returning true closes the
  // input and tells the dialog to cancel its own dismiss.
  const handleEscapeIntercept = useCallback(() => {
    if (!isAdding || document.activeElement !== inputRef.current) {
      return false;
    }
    handleCancelAdding();
    return true;
  }, [isAdding, handleCancelAdding]);

  useEffect(() => {
    onRegisterEscapeIntercept?.(handleEscapeIntercept);
    return () => {
      onRegisterEscapeIntercept?.(null);
    };
  }, [onRegisterEscapeIntercept, handleEscapeIntercept]);

  const handleConfirmAdd = () => {
    const normalized = normalizeDomain(inputValue);
    if (!normalized || isAtCap) {
      return;
    }

    if (!DOMAIN_REGEX.test(normalized)) {
      toast({
        type: "error",
        description: `"${normalized}" doesn't look like a valid domain.`,
      });
      return;
    }

    if (domains.includes(normalized)) {
      toast({
        type: "error",
        description: `"${normalized}" is already in the list.`,
      });
      return;
    }

    setDomains((prev) => [...prev, normalized]);
    setInputValue("");

    // Keep the inline input open for rapid entry, unless we just hit the cap.
    if (domains.length + 1 >= MAX_DOMAINS) {
      setIsAdding(false);
    } else {
      inputRef.current?.focus();
    }
  };

  const handleRemoveDomain = (domain: string) => {
    setDomains((prev) => prev.filter((item) => item !== domain));
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleConfirmAdd();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handleCancelAdding();
    }
  };

  // Blur only cancels when the input is empty — a blur triggered by clicking the
  // ✓ button (input still has content) must not close the input before onClick.
  const handleInputBlur = () => {
    if (inputValue.trim().length === 0) {
      setIsAdding(false);
    }
  };

  const handleSave = async () => {
    if (!isDirty || isMutating) {
      return;
    }

    try {
      // putFetcher rethrows the server's `error` string as the Error message
      // (e.g. "jacobs.com is a public email provider"). Replace local state
      // with the server-normalized list on success.
      const { emailDomains } = await trigger({ emailDomains: domains });
      setDomains(emailDomains);
      setSavedDomains(emailDomains);
      toast({ type: "success", description: "Email domains updated." });
      onSaved?.();
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error && error.message
            ? error.message
            : "Couldn't update email domains. Please try again.",
      });
    }
  };

  if (isChecking) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  const blurb = (
    <p className="text-sm text-muted-foreground">
      Users who sign up with an email on one of these domains are automatically
      affiliated with this organization (they receive a role and viewer access).
      Subdomains match automatically.
    </p>
  );

  if (!canEdit) {
    return (
      <div className="space-y-4">
        {blurb}
        {domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No email domains configured.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {domains.map((domain) => (
              <span
                key={domain}
                className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-sm"
              >
                {domain}
              </span>
            ))}
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Only organization owners can edit email domains.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {blurb}

      <div className="flex flex-wrap items-center gap-2">
        {domains.map((domain) => (
          <span
            key={domain}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 py-1 pl-3 pr-1.5 text-sm"
          >
            <span>{domain}</span>
            <button
              type="button"
              onClick={() => handleRemoveDomain(domain)}
              aria-label={`Remove ${domain}`}
              className="flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}

        {isAdding ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-input bg-background py-0.5 pl-3 pr-1 focus-within:ring-1 focus-within:ring-ring">
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleInputKeyDown}
              onBlur={handleInputBlur}
              placeholder="example.com"
              autoFocus
              autoComplete="off"
              className="w-32 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={handleConfirmAdd}
              aria-label="Confirm add domain"
              className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Check className="size-3.5" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={handleStartAdding}
            disabled={isAtCap}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground",
              isAtCap && "cursor-not-allowed opacity-50 hover:border-border",
            )}
          >
            <Plus className="size-3.5" />
            Add domain
          </button>
        )}
      </div>

      {isAtCap ? (
        <p className="text-xs text-muted-foreground">
          You&apos;ve reached the maximum of {MAX_DOMAINS} domains.
        </p>
      ) : null}

      <Button
        type="button"
        onClick={handleSave}
        disabled={!isDirty || isMutating}
      >
        {isMutating ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
