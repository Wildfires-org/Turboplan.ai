"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Command } from "cmdk";
import { Loader2, UserPlus, X } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  cn,
  GLASS_INSET_CLASS,
  GLASS_POPOVER_CLASS,
  generateDisplayName,
  generateInitials,
} from "@wildfires-org/turboplan-utils";

import {
  type SearchableUser,
  type UserSearchScope,
  useUserSearch,
} from "../../hooks/use-user-search";
import { isValidEmail, resolveEmailInput } from "./email-input";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Represents an existing user selected from search results
 */
export type SelectedUser = SearchableUser;

/**
 * Represents an email to invite (user doesn't exist yet)
 */
export type InviteUser = {
  type: "invite";
  email: string;
};

/**
 * Union type for selected values - either existing users or invites
 */
export type SelectedUserValue = SelectedUser | InviteUser;

/**
 * Type guard to check if a value is an invite
 */
export function isInviteUser(value: SelectedUserValue): value is InviteUser {
  return "type" in value && value.type === "invite";
}

/**
 * Props for the UserSelector component
 */
export type UserSelectorProps = {
  /** Currently selected users/invites */
  value: SelectedUserValue[];
  /** Callback when selection changes */
  onChange: (value: SelectedUserValue[]) => void;
  /**
   * Entity the search runs for (its organization tree is searchable; anyone
   * else only by exact email), or "admin" for the admin-only global search.
   */
  searchScope: UserSearchScope;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Maximum number of users that can be selected (undefined = unlimited) */
  maxSelections?: number;
  /** Whether to allow inviting new users via email */
  allowInvite?: boolean;
  /** Emails to exclude from search results and invite options (e.g. existing members) */
  excludeEmails?: Set<string>;
  /** Additional class name for the container */
  className?: string;
};

// ============================================================================
// CONSTANTS
// ============================================================================

/** Shorter queries don't search, and no (possibly stale) results are shown */
const MIN_QUERY_LENGTH = 3;

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Multi-select user search component with fuzzy matching and invite capability.
 *
 * Features:
 * - Fuzzy search on email and name (pg_trgm)
 * - 300ms debounce on search
 * - Multi-select with removable chips
 * - "Create and invite" option for valid emails not in system
 * - Keyboard navigation support
 *
 * @example
 * ```tsx
 * const [selected, setSelected] = useState<SelectedUserValue[]>([]);
 *
 * <UserSelector
 *   value={selected}
 *   onChange={setSelected}
 *   searchScope={{ entityType: "project", entityId: projectId }}
 *   placeholder="Search users..."
 *   allowInvite
 * />
 * ```
 */
export function UserSelector({
  value,
  onChange,
  searchScope,
  placeholder = "Search users by name or email...",
  disabled = false,
  maxSelections,
  allowInvite = true,
  excludeEmails,
  className,
}: UserSelectorProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [activeValue, setActiveValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup blur timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Search for users
  const { users, isLoading, shouldSearch } = useUserSearch(
    inputValue,
    searchScope,
    { enabled: open && !disabled, minQueryLength: MIN_QUERY_LENGTH },
  );

  // Filter out already selected users from results
  const selectedIds = useMemo(
    () =>
      new Set(
        value
          .filter((v): v is SelectedUser => !isInviteUser(v))
          .map((u) => u.id),
      ),
    [value],
  );

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          !selectedIds.has(user.id) &&
          (!excludeEmails || !excludeEmails.has(user.email.toLowerCase())),
      ),
    [users, selectedIds, excludeEmails],
  );

  // Emails that can't be picked again: excluded (e.g. existing members) or
  // already selected
  const takenEmails = useMemo(() => {
    const emails = new Set<string>(excludeEmails);
    for (const item of value) {
      emails.add(item.email.toLowerCase());
    }
    return emails;
  }, [excludeEmails, value]);

  // A typed email never shows fuzzy results: either its exact user, a
  // "taken" hint, or the invite option. Null for regular (non-email) input.
  const emailInput = useMemo(
    () => resolveEmailInput(inputValue, users, takenEmails),
    [inputValue, users, takenEmails],
  );

  // Results can be stale from a previous query (`keepPreviousData`), e.g. just
  // after a pick clears the input — never show them for a too-short query.
  const isQueryTooShort = inputValue.trim().length < MIN_QUERY_LENGTH;

  const visibleUsers = useMemo(() => {
    if (isQueryTooShort) {
      return [];
    }
    if (!emailInput) {
      return filteredUsers;
    }
    return emailInput.status === "match" ? [emailInput.user] : [];
  }, [isQueryTooShort, emailInput, filteredUsers]);

  const showInviteOption = allowInvite && emailInput?.status === "new";
  const isTakenEmail = emailInput?.status === "taken";

  // cmdk item values are trimmed, so build the invite value the same way
  const inviteItemValue = `invite-${inputValue.trim()}`;

  // Controlled highlight: cmdk only auto-selects the first item while it holds
  // no value, so when results swap items (e.g. the invite option gives way to
  // the exact user) a stale value would leave nothing highlighted and Enter
  // would do nothing. Fall back to the first visible item instead.
  const itemValues = [
    ...visibleUsers.map((user) => user.id),
    ...(showInviteOption ? [inviteItemValue] : []),
  ];
  const selectedValue = itemValues.includes(activeValue)
    ? activeValue
    : (itemValues[0] ?? "");

  // Check if max selections reached
  const maxReached =
    maxSelections !== undefined && value.length >= maxSelections;

  // After a pick, keep focus for the next entry but close the dropdown so it
  // doesn't cover what sits below (e.g. a pending list); typing reopens it.
  const resetAfterPick = useCallback(() => {
    setInputValue("");
    inputRef.current?.focus();
    // Must follow focus(): after a mouse pick the input had blurred, so
    // focus() fires onFocus, which opens the dropdown again.
    setOpen(false);
  }, []);

  // Handle selecting a user
  const handleSelectUser = useCallback(
    (user: SearchableUser) => {
      if (maxReached) return;

      onChange([...value, user]);
      resetAfterPick();
    },
    [value, onChange, maxReached, resetAfterPick],
  );

  // Handle inviting a new user
  const handleInvite = useCallback(() => {
    if (maxReached) return;
    if (!isValidEmail(inputValue)) return;

    const invite: InviteUser = {
      type: "invite",
      email: inputValue.trim(),
    };
    onChange([...value, invite]);
    resetAfterPick();
  }, [value, onChange, inputValue, maxReached, resetAfterPick]);

  // Handle removing a selected user/invite
  const handleRemove = useCallback(
    (index: number) => {
      const newValue = [...value];
      newValue.splice(index, 1);
      onChange(newValue);
    },
    [value, onChange],
  );

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
        // Remove last selected item on backspace when input is empty
        handleRemove(value.length - 1);
      }
    },
    [inputValue, value.length, handleRemove],
  );

  return (
    <div className={cn("relative", className)}>
      <Command
        className="overflow-visible bg-transparent"
        shouldFilter={false}
        value={selectedValue}
        onValueChange={setActiveValue}
      >
        {/* Selected chips and input */}
        <div
          className={cn(
            "flex h-10 flex-wrap gap-1.5 rounded-xl px-3 py-2 text-sm",
            GLASS_INSET_CLASS,
            "focus-within:outline focus-within:outline-2 focus-within:outline-brand-700/40",
            disabled && "cursor-not-allowed opacity-50",
          )}
          onClick={() => {
            // The input is disabled then, so it can't blur to close the list
            if (disabled || maxReached) {
              return;
            }
            inputRef.current?.focus();
            // The input may already be focused (after a pick), so focus alone
            // wouldn't reopen the dropdown
            setOpen(true);
          }}
        >
          {/* Selected items as chips */}
          {value.map((item, index) => (
            <span
              key={isInviteUser(item) ? `invite-${item.email}` : item.id}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm",
                isInviteUser(item)
                  ? "border border-dashed border-orange-300 bg-orange-50 text-orange-700"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {isInviteUser(item) ? (
                <>
                  <UserPlus className="size-3" />
                  <span>{item.email}</span>
                </>
              ) : (
                <span>{generateDisplayName(item)}</span>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(index);
                  }}
                  className="ml-0.5 rounded-sm hover:bg-muted-foreground/20"
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}

          {/* Search input */}
          <Command.Input
            ref={inputRef}
            value={inputValue}
            onValueChange={(nextValue) => {
              setInputValue(nextValue);
              setOpen(true);
            }}
            onFocus={() => {
              // A pending close from a mouse pick must not hide the reopened list
              if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
              }
              setOpen(true);
            }}
            onBlur={() => {
              // Delay closing to allow clicking on items
              blurTimeoutRef.current = setTimeout(() => setOpen(false), 200);
            }}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : ""}
            disabled={disabled || maxReached}
            className={cn(
              "flex-1 bg-transparent outline-none placeholder:text-muted-foreground",
              "min-w-[120px]",
              (disabled || maxReached) && "cursor-not-allowed",
            )}
          />

          {/* Loading indicator */}
          {isLoading && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Dropdown results */}
        {open && !disabled && !maxReached && (
          <div
            className={cn(
              "absolute top-full z-50 mt-1 w-full text-popover-foreground",
              GLASS_POPOVER_CLASS,
            )}
          >
            <Command.List className="max-h-60 overflow-auto p-1">
              {/* Typed email is already selected or excluded — nothing to pick */}
              {isTakenEmail && (
                <div className="break-words px-3 py-4 text-center text-sm text-muted-foreground">
                  {inputValue.trim()} is already added or a member
                </div>
              )}

              {/* Hint to type more characters */}
              {(isQueryTooShort || !shouldSearch) &&
                !showInviteOption &&
                !isTakenEmail &&
                visibleUsers.length === 0 && (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Type at least {MIN_QUERY_LENGTH} characters to search
                  </div>
                )}

              {/* Loading state */}
              {shouldSearch &&
                !isQueryTooShort &&
                isLoading &&
                !isTakenEmail &&
                visibleUsers.length === 0 && (
                  <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Searching...
                  </div>
                )}

              {/* No results message */}
              {shouldSearch &&
                !isQueryTooShort &&
                visibleUsers.length === 0 &&
                !showInviteOption &&
                !isTakenEmail &&
                !isLoading && (
                  <Command.Empty className="py-4 text-center text-sm text-muted-foreground">
                    No users found
                  </Command.Empty>
                )}

              {/* User results (only the exact match for a typed email) */}
              {visibleUsers.map((user) => (
                <Command.Item
                  key={user.id}
                  value={user.id}
                  onSelect={() => handleSelectUser(user)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2",
                    "aria-selected:bg-brandAlt-100 aria-selected:text-brand-900",
                  )}
                >
                  {/* Avatar */}
                  <Avatar className="size-8 shrink-0 text-xs font-medium">
                    <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback>{generateInitials(user)}</AvatarFallback>
                  </Avatar>

                  {/* Name and email */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {generateDisplayName(user)}
                    </span>
                    {(user.firstName || user.lastName) && (
                      <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    )}
                  </div>
                </Command.Item>
              ))}

              {/* Invite option */}
              {showInviteOption && (
                <Command.Item
                  value={inviteItemValue}
                  onSelect={handleInvite}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2",
                    "aria-selected:bg-brandAlt-100 aria-selected:text-brand-900",
                  )}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-orange-300 bg-orange-50">
                    <UserPlus className="size-4 text-orange-600" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium text-orange-700">
                      Create and invite
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {inputValue.trim()}
                    </span>
                  </div>
                </Command.Item>
              )}
            </Command.List>
          </div>
        )}
      </Command>
    </div>
  );
}
