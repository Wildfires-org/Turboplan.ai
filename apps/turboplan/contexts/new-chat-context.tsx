"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

interface NewChatContextType {
  newChatKey: number;
  requestNewChat: () => void;
}

const NewChatContext = createContext<NewChatContextType>({
  newChatKey: 0,
  requestNewChat: () => {},
});

export function NewChatProvider({ children }: { children: ReactNode }) {
  const [newChatKey, setNewChatKey] = useState(0);
  const requestNewChat = useCallback(() => setNewChatKey((k) => k + 1), []);
  return (
    <NewChatContext.Provider value={{ newChatKey, requestNewChat }}>
      {children}
    </NewChatContext.Provider>
  );
}

export function useNewChat() {
  return useContext(NewChatContext);
}
