'use client';

import { useEffect } from 'react';
import { useChat } from '@/context/ChatContext';
import type { EveContext } from '@/lib/eve-validation';

// Tells EVE which page the visitor is on. Rendered once per page (server
// pages can't call the hook themselves); renders nothing. The name must be in
// EVE_CONTEXTS or the server drops it. On unmount the context falls back to
// Home so a page without a setter never inherits the previous page's.
export default function ChatContextSetter({ context }: { context: EveContext }) {
  const { setContext } = useChat();
  useEffect(() => {
    setContext(context);
    return () => setContext('Home');
  }, [context, setContext]);
  return null;
}
