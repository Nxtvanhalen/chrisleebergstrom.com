'use client';

import { AnimatePresence, motion } from 'motion/react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useChat } from '@/context/ChatContext';
import ChatPanel from './ChatPanel';
import EveAvatar from './EveAvatar';

const NOTIFICATION_SHOWN_KEY = 'eve_notification_shown_v2';

// sessionStorage can throw in private/locked-down browsers; the nudge is
// cosmetic, so treat any failure as "already shown".
function hasShownNotification(): boolean {
  try {
    return sessionStorage.getItem(NOTIFICATION_SHOWN_KEY) !== null;
  } catch {
    return true;
  }
}

function markNotificationShown() {
  try {
    sessionStorage.setItem(NOTIFICATION_SHOWN_KEY, 'true');
  } catch {
    // Ignore.
  }
}

export default function PersistentChat() {
  const { isOpen, toggleChat, closeChat } = useChat();
  const [showNotification, setShowNotification] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (hasShownNotification() || isOpen) return;

    // Delay slightly for effect (reduced to 1s)
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      setShowNotification(true);
      markNotificationShown();

      // Auto-hide after 5 seconds
      hideTimer = setTimeout(() => setShowNotification(false), 5000);
    }, 1000);

    return () => {
      clearTimeout(timer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [isOpen]);

  // When the panel closes, put focus back on the control that opens it (WCAG
  // 2.4.3) instead of letting the browser drop it on <body>. ChatPanel handles
  // the other direction by focusing its input on mount.
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      toggleRef.current?.focus({ preventScroll: true });
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const handlePanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeChat();
    }
  };

  return (
    <div className="fixed bottom-6 right-[15px] z-100 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          // Non-modal dialog: the page stays usable behind it, so no aria-modal
          // and no focus trap. A native <dialog> needs `open` plus UA styling
          // that fights the animated panel, hence the role on a div.
          <motion.div
            role="dialog"
            aria-labelledby="eve-chat-title"
            onKeyDown={handlePanelKeyDown}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-4 mr-4 w-[90vw] md:w-[400px] h-[450px] max-h-[calc(100vh-180px)] bg-black/90 backdrop-blur-xl border border-mauve/50 rounded-2xl shadow-[0_0_30px_rgba(147,112,219,0.3)] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-linear-to-r from-mauve/20 to-transparent">
              <div className="flex items-center gap-3">
                <EveAvatar width={72} height={40} className="border border-mauve/50" />
                <div>
                  <h3 id="eve-chat-title" className="font-heading text-white text-sm tracking-wide">
                    EVE
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-[10px] text-white/60 uppercase tracking-wider">
                      Online · Site-only
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeChat}
                className="text-white/50 hover:text-white transition-colors p-1"
                aria-label="Close chat"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-hidden relative">
              <ChatPanel />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNotification && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bottom-20 right-0 mb-4 mr-[-12px] bg-black/80 backdrop-blur-md border border-mauve/50 p-2 rounded-2xl rounded-br-none shadow-[0_0_20px_rgba(147,112,219,0.3)] max-w-[90px]"
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-col items-start gap-1 border-b border-white/10 pb-2">
                <EveAvatar width={64} height={36} className="border border-mauve/50" />
                <span className="text-[10px] font-bold text-mauve uppercase tracking-wider leading-tight block">
                  Incoming Transmission
                </span>
              </div>
              <div>
                <p className="text-[11px] text-white/90 leading-tight">
                  I'm EVE — Chris's portfolio assistant. Ask me about the work, the road, or how to
                  reach him.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button Container */}
      <div className="relative flex items-center">
        <AnimatePresence>
          {!isOpen && !showNotification && (
            <motion.div
              initial={{ opacity: 0, y: 10, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 10, x: '-50%' }}
              className="absolute bottom-full mb-1.5 left-1/2 px-3 py-1.5 bg-black/80 rounded-xl text-white text-xs font-medium whitespace-nowrap"
              aria-hidden="true"
            >
              EVE AI
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          ref={toggleRef}
          type="button"
          onClick={toggleChat}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="bg-transparent border-none p-0 cursor-pointer outline-hidden focus-visible:ring-2 focus-visible:ring-mauve rounded-lg"
          aria-label={isOpen ? 'Close EVE AI chat' : 'Open EVE AI chat assistant'}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <div className="w-20 h-12 rounded-lg bg-black/80 border-2 border-mauve/50 flex items-center justify-center text-mauve">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          ) : (
            <EveAvatar width={80} height={80} className="" />
          )}
        </motion.button>
      </div>
    </div>
  );
}
