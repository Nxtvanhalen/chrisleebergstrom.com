'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChat } from '@/context/ChatContext';
import {
  CHAT_HISTORY_KEY,
  type ChatMessage,
  LEGACY_STORAGE_KEYS,
  parseStoredHistory,
  parseStoredResponseId,
  RESPONSE_ID_KEY,
  serializeHistory,
  serializeResponseId,
} from '@/lib/eve-storage';
import type { EveStreamEvent } from '@/lib/eve-stream';
import EveAvatar from './EveAvatar';

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    "Welcome — I'm EVE, Chris's portfolio assistant. Ask me about the work, the road, or how to reach him.",
};

const GENERIC_ERROR_TEXT =
  "I'm experiencing some technical difficulties. Please try again in a moment, or feel free to email me directly!";
const RATE_LIMIT_TEXT = "I'm getting a lot of messages right now — give it a minute and try again.";
const CUT_OFF_NOTE = 'This reply was cut off.';

// localStorage can be missing (SSR), disabled (private mode, strict cookie
// settings) or full; none of that should ever break the chat.
function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore: history just won't persist across reloads.
  }
}

function storageRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

// Thrown for non-2xx replies so the catch block can tailor the visible text.
class ChatRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ChatRequestError';
  }
}

// Shared markdown renderer config for completed assistant messages. Module
// scope so the renderer isn't given a new components object every render.
const markdownComponents: Components = {
  a: ({ node, ...props }) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className="text-mauve underline hover:text-white transition-colors"
    />
  ),
  p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0" />,
  ul: ({ node, ...props }) => <ul {...props} className="list-disc ml-4 mb-2" />,
  ol: ({ node, ...props }) => <ol {...props} className="list-decimal ml-4 mb-2" />,
  li: ({ node, ...props }) => <li {...props} className="mb-1" />,
};

// Shown after the user sends, before the first token streams back.
function TypingIndicator() {
  return (
    <div className="animate-message-in self-start mr-auto max-w-[85%] px-4 py-3 bg-white/4 border border-white/10 rounded-2xl rounded-bl-md">
      <div className="flex items-center gap-2 mb-2">
        <EveAvatar width={28} height={28} className="border border-mauve/40" />
        <span className="text-[11px] font-bold tracking-wider text-mauve/90">EVE</span>
      </div>
      <div className="flex items-center gap-1.5 h-3" role="status" aria-label="EVE is typing">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="eve-typing-dot w-1.5 h-1.5 rounded-full bg-mauve"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const { currentContext } = useChat();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  // Last completed EVE reply, read out by the aria-live region. Updated once per
  // reply rather than per streamed token so screen readers aren't flooded.
  const [announcement, setAnnouncement] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Drives the smooth typewriter reveal; held in a ref so we can cancel it on unmount.
  const rafRef = useRef<number | null>(null);
  // In-flight /api/chat request, aborted if the panel unmounts mid-reply.
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  // Set by a user send: once the reply settles, focus goes back to the input.
  const refocusRef = useRef(false);

  // Restore persisted state on mount, then move focus into the panel (WCAG
  // 2.4.3). preventScroll keeps the page from jumping when the panel opens.
  useEffect(() => {
    mountedRef.current = true;

    const history = parseStoredHistory(storageGet(CHAT_HISTORY_KEY));
    if (history) setMessages(history);
    else storageRemove(CHAT_HISTORY_KEY);
    setResponseId(parseStoredResponseId(storageGet(RESPONSE_ID_KEY), Date.now()));
    for (const key of LEGACY_STORAGE_KEYS) storageRemove(key);

    inputRef.current?.focus({ preventScroll: true });

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Persist history — but not on every streaming frame. While a reply reveals we
  // skip the (expensive) serialize+write and persist once when it settles.
  useEffect(() => {
    if (!isStreaming && messages.length > 1) {
      // Don't save if it's just the initial welcome message
      storageSet(CHAT_HISTORY_KEY, serializeHistory(messages));
    }

    // Scroll to bottom (kept live so the view follows the streaming text)
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Return focus to the input after a reply (or failure). The input is
  // `disabled` while busy, so focusing it from inside the send handler is a
  // no-op and focus falls to <body>; this runs after the re-render that
  // re-enables it. Skipped if the visitor has meanwhile focused something
  // outside the panel.
  const busy = isTyping || isStreaming;
  useEffect(() => {
    if (busy || !refocusRef.current) return;
    refocusRef.current = false;
    const active = document.activeElement;
    if (active && active !== document.body && !rootRef.current?.contains(active)) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [busy]);

  const clearResponseId = () => {
    setResponseId(null);
    storageRemove(RESPONSE_ID_KEY);
  };

  const startNewConversation = () => {
    if (isTyping || isStreaming) return;
    setMessages([WELCOME_MESSAGE]);
    setInput('');
    setAnnouncement('');
    clearResponseId();
    storageRemove(CHAT_HISTORY_KEY);
    inputRef.current?.focus({ preventScroll: true });
  };

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || isTyping || isStreaming) return;

    const userMsg: ChatMessage = { role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    refocusRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    // Replace the last (assistant) message in place as the reply reveals.
    const replaceLast = (text: string, note?: string) =>
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = note
          ? { role: 'assistant', content: text, note }
          : { role: 'assistant', content: text };
        return next;
      });

    // Smooth typewriter reveal. The network delivers tokens in uneven bursts, so
    // we buffer the full received text in `target` and reveal it at a steady
    // cadence (`shown` chars). Speed eases up the further `shown` trails `target`,
    // so long bursts drain quickly without the reveal ever lagging far behind.
    const BASE_CPS = 40; // baseline reveal speed (characters/second)
    const CATCHUP = 0; // extra chars/second per pending character (0 = constant speed)
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let target = '';
    let shown = 0;
    let streamDone = false;
    let finalText: string | null = null;
    // Set when the server reports the reply failed or was cut off after some
    // text already arrived; shown under the partial reply.
    let note: string | undefined;
    let finalized = false;
    let lastTs: number | null = null;

    const stopRaf = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const finalizeReply = () => {
      if (finalized) return;
      finalized = true;
      stopRaf();
      const text = finalText ?? target;
      replaceLast(text, note);
      setAnnouncement(note ? `${text} ${note}` : text);
      setIsStreaming(false);
    };

    const tick = (ts: number) => {
      // The panel closed mid-reveal; the mount cleanup already cancelled us.
      if (!mountedRef.current) return;

      const dt = lastTs == null ? 0 : (ts - lastTs) / 1000;
      lastTs = ts;

      if (shown < target.length) {
        const remaining = target.length - shown;
        const cps = Math.max(BASE_CPS, remaining * CATCHUP);
        // Accumulate fractional progress so slow speeds aren't floored up to one
        // character per frame (≈ the display's refresh rate). Render floor(shown).
        shown = Math.min(target.length, shown + cps * dt);
        replaceLast(target.slice(0, Math.floor(shown)));
      }

      if (streamDone && shown >= target.length) {
        finalizeReply();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const post = (previousResponseId: string | null) =>
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: content,
          previousResponseId: previousResponseId ?? undefined,
          context: currentContext,
        }),
        signal: controller.signal,
      });

    const readError = async (res: Response): Promise<{ message: string; code?: string }> => {
      const data = (await res.json().catch(() => null)) as {
        error?: unknown;
        code?: unknown;
      } | null;
      return {
        message: typeof data?.error === 'string' ? data.error : 'Network response was not ok',
        code: typeof data?.code === 'string' ? data.code : undefined,
      };
    };

    let placeholderAdded = false;

    try {
      let res = await post(responseId);

      // A stale previous_response_id (OpenAI expires them) is the usual reason a
      // send fails once a conversation is a few days old. Drop the id and retry
      // once without it; the visitor just loses EVE's memory of earlier turns.
      // Other failures (outages, rate limits) keep the id so memory survives them.
      if (!res.ok && responseId) {
        const err = await readError(res);
        if (err.code === 'stale_conversation') {
          clearResponseId();
          res = await post(null);
        } else {
          throw new ChatRequestError(err.message, res.status);
        }
      }

      if (!res.ok || !res.body) {
        const err = await readError(res);
        throw new ChatRequestError(err.message, res.status);
      }

      // First byte is on the way — swap the "thinking" indicator for a live,
      // streaming bubble and start revealing buffered tokens at a steady pace.
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
      placeholderAdded = true;
      setIsTyping(false);
      setIsStreaming(true);
      if (!reduceMotion) {
        rafRef.current = requestAnimationFrame(tick);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          let evt: EveStreamEvent;
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }

          if (evt.type === 'delta' && evt.text) {
            target += evt.text;
            if (reduceMotion) {
              shown = target.length;
              replaceLast(target);
            }
          } else if (evt.type === 'done') {
            // Server sends the authoritative full text on completion.
            if (typeof evt.finalText === 'string') {
              finalText = evt.finalText;
              if (evt.finalText !== target) target = evt.finalText;
            }
            if (evt.responseId && evt.responseId !== responseId) {
              setResponseId(evt.responseId);
              storageSet(RESPONSE_ID_KEY, serializeResponseId(evt.responseId, Date.now()));
            }
            streamDone = true;
          } else if (evt.type === 'error') {
            // Failed or cut off. Keep whatever text arrived and flag it; only
            // fall back to the error text itself when there is nothing to show.
            if (target) {
              note = evt.message || CUT_OFF_NOTE;
            } else {
              target = evt.message || "I couldn't process that request. Please try again.";
            }
            finalText = target;
            streamDone = true;
            if (reduceMotion) {
              shown = target.length;
              replaceLast(target);
            }
          }
        }
      }

      // Stream closed. Make sure we have something, then let the reveal finish.
      streamDone = true;
      if (!target) {
        target = "I couldn't process that request. Please try again.";
        finalText = target;
      }
      // If no reveal loop is running (reduced motion, or it already drained),
      // settle immediately; otherwise `tick` finalizes once it catches up.
      if (rafRef.current == null) {
        finalizeReply();
      }
    } catch (err: unknown) {
      stopRaf();
      // Unmounted (panel closed) — nothing to render, nothing to report.
      if (controller.signal.aborted || !mountedRef.current) return;

      const errorText =
        err instanceof ChatRequestError && err.status === 429
          ? RATE_LIMIT_TEXT
          : GENERIC_ERROR_TEXT;
      if (placeholderAdded) {
        replaceLast(errorText);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: errorText }]);
      }
      setAnnouncement(errorText);
      setIsStreaming(false);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      // isStreaming is cleared by finalizeReply (or the catch) so the caret/raw
      // text stays until the reveal completes — not the instant the network ends.
      if (mountedRef.current) setIsTyping(false);
    }
  };

  const hasConversation = messages.length > 1 || responseId !== null;

  return (
    <div ref={rootRef} className="flex flex-col h-full font-body">
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 bg-transparent">
        <div className="flex flex-col space-y-3">
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isStreamingMsg = isStreaming && !isUser && idx === messages.length - 1;
            return (
              <div
                key={idx}
                className={`animate-message-in max-w-[85%] px-4 py-3 ${
                  isUser
                    ? 'self-end ml-auto bg-mauve/15 border border-mauve/30 rounded-2xl rounded-br-md text-white'
                    : 'self-start mr-auto bg-white/4 border border-white/10 rounded-2xl rounded-bl-md text-white'
                }`}
              >
                {!isUser && (
                  <div className="flex items-center gap-2 mb-2">
                    <EveAvatar width={28} height={28} className="border border-mauve/40" />
                    <span className="text-[11px] font-bold tracking-wider text-mauve/90">EVE</span>
                  </div>
                )}
                <div className="leading-relaxed markdown-content">
                  {isStreamingMsg ? (
                    // Render raw text while streaming so partial markdown never
                    // flickers; swap to formatted markdown once the reply completes.
                    <span className="whitespace-pre-wrap">
                      {msg.content}
                      <span className="eve-stream-cursor" aria-hidden="true" />
                    </span>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
                {msg.note && !isStreamingMsg && (
                  <p className="mt-2 text-[11px] italic text-white/50">{msg.note}</p>
                )}
              </div>
            );
          })}
          {isTyping && <TypingIndicator />}
        </div>
      </div>

      {/* Screen-reader announcement of each completed reply; visually hidden
          because the transcript above is already on screen. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {hasConversation && (
        <div className="flex justify-end px-3 py-1 border-t border-white/10">
          <button
            type="button"
            onClick={startNewConversation}
            disabled={busy}
            className="text-[10px] font-mono uppercase tracking-wider text-white/50 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            New conversation
          </button>
        </div>
      )}

      <form onSubmit={sendMessage} className="flex border-t border-mauve/30 bg-black/30">
        <input
          ref={inputRef}
          className="flex-1 p-4 bg-transparent text-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-mauve/50 rounded-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            busy ? 'EVE is responding…' : "Ask about Chris's work, projects, or how to reach him…"
          }
          disabled={busy}
          aria-label="Message EVE"
          autoComplete="off"
          maxLength={4000}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send message"
          className="px-6 bg-transparent text-mauve font-bold hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-mauve hover:border-white hover:scale-105 active:scale-95"
        >
          <span aria-hidden="true">{busy ? '…' : '→'}</span>
        </button>
      </form>
    </div>
  );
}
