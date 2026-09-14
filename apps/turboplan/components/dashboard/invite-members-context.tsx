"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

interface InviteMembersContextValue {
  showInviteForm: boolean;
  openInviteForm: () => void;
  closeInviteForm: () => void;
}

const InviteMembersContext = createContext<InviteMembersContextValue | null>(
  null,
);

export function InviteMembersProvider({ children }: { children: ReactNode }) {
  const [showInviteForm, setShowInviteForm] = useState(false);

  const openInviteForm = useCallback(() => setShowInviteForm(true), []);
  const closeInviteForm = useCallback(() => setShowInviteForm(false), []);

  return (
    <InviteMembersContext.Provider
      value={{ showInviteForm, openInviteForm, closeInviteForm }}
    >
      {children}
    </InviteMembersContext.Provider>
  );
}

const noop = () => {};

const defaultValue: InviteMembersContextValue = {
  showInviteForm: false,
  openInviteForm: noop,
  closeInviteForm: noop,
};

export function useInviteMembers() {
  const context = useContext(InviteMembersContext);
  return context ?? defaultValue;
}
