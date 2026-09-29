"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Command } from "cmdk";
import { Check, Loader2, UserPlus, X } from "lucide-react";

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
// HELPERS
// ============================================================================

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Check if a string is a valid email address
 */
function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

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
    { enabled: open && !disabled },
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

  // Check if input looks like an email (for hiding search results)
  const isEmailInput = useMemo(() => isValidEmail(inputValue), [inputValue]);

  // Check if we should show the invite option
  const showInviteOption = useMemo(() => {
    if (!allowInvite) return false;
    if (!isEmailInput) return false;

    const trimmedEmail = inputValue.trim().toLowerCase();

    // Check if email is already in search results
    const emailInResults = users.some(
      (user) => user.email.toLowerCase() === trimmedEmail,
    );
    if (emailInResults) return false;

    // Check if email is excluded (existing member)
    if (excludeEmails?.has(trimmedEmail)) return false;

    // Check if email is already selected
    const emailAlreadySelected = value.some((v) => {
      if (isInviteUser(v)) {
        return v.email.toLowerCase() === trimmedEmail;
      }
      return v.email.toLowerCase() === trimmedEmail;
    });
    if (emailAlreadySelected) return false;

    return true;
  }, [allowInvite, isEmailInput, inputValue, users, value]);

  // Hide search results when user typed a valid email that's not in the system
  // This provides cleaner UX: either search for users OR invite a specific email
  const shouldHideSearchResults = isEmailInput && showInviteOption;

  // Check if max selections reached
  const maxReached =
    maxSelections !== undefined && value.length >= maxSelections;

  // Handle selecting a user
  const handleSelectUser = useCallback(
    (user: SearchableUser) => {
      if (maxReached) return;

      onChange([...value, user]);
      setInputValue("");
      inputRef.current?.focus();
    },
    [value, onChange, maxReached],
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
    setInputValue("");
    inputRef.current?.focus();
  }, [value, onChange, inputValue, maxReached]);

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
      <Command className="overflow-visible bg-transparent" shouldFilter={false}>
        {/* Selected chips and input */}
        <div
          className={cn(
            "flex h-10 flex-wrap gap-1.5 rounded-xl px-3 py-2 text-sm",
            GLASS_INSET_CLASS,
            "focus-within:outline focus-within:outline-2 focus-within:outline-brand-700/40",
            disabled && "cursor-not-allowed opacity-50",
          )}
          onClick={() => inputRef.current?.focus()}
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
            onValueChange={setInputValue}
            onFocus={() => setOpen(true)}
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
        {open && !disabled && (
          <div
            className={cn(
              "absolute top-full z-50 mt-1 w-full text-popover-foreground",
              GLASS_POPOVER_CLASS,
            )}
          >
            <Command.List className="max-h-60 overflow-auto p-1">
              {/* Hint to type more characters */}
              {!shouldSearch &&
                !showInviteOption &&
                filteredUsers.length === 0 && (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Type at least 3 characters to search
                  </div>
                )}

              {/* Loading state */}
              {shouldSearch && isLoading && filteredUsers.length === 0 && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Searching...
                </div>
              )}

              {/* No results message */}
              {shouldSearch &&
                filteredUsers.length === 0 &&
                !showInviteOption &&
                !isLoading && (
                  <Command.Empty className="py-4 text-center text-sm text-muted-foreground">
                    No users found
                  </Command.Empty>
                )}

              {/* User results - hidden when user typed a valid non-existent email */}
              {!shouldHideSearchResults &&
                filteredUsers.map((user) => (
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

                    {/* Selected indicator */}
                    {selectedIds.has(user.id) && (
                      <Check className="size-4 text-brand-700" />
                    )}
                  </Command.Item>
                ))}

              {/* Invite option */}
              {showInviteOption && (
                <>
                  {!shouldHideSearchResults && filteredUsers.length > 0 && (
                    <div className="my-1 h-px bg-border" />
                  )}
                  <Command.Item
                    value={`invite-${inputValue}`}
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
                </>
              )}
            </Command.List>
          </div>
        )}
      </Command>
    </div>
  );
}
