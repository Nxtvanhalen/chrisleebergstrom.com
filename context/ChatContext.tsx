'use client';

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import type { EveContext } from '@/lib/eve-validation';

interface ChatContextType {
  isOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  // Which part of the site the visitor is on; sent with each message so EVE can
  // tailor replies. Only allowlisted names (see lib/eve-validation) are accepted.
  currentContext: EveContext;
  setContext: (context: EveContext) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentContext, setContext] = useState<EveContext>('Home');

  // Stable callbacks + memoised value so consumers that list them as effect
  // dependencies (ProjectsClient, PersistentChat) don't re-run every render.
  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);
  const toggleChat = useCallback(() => setIsOpen((prev) => !prev), []);

  const value = useMemo<ChatContextType>(
    () => ({ isOpen, openChat, closeChat, toggleChat, currentContext, setContext }),
    [isOpen, openChat, closeChat, toggleChat, currentContext],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
