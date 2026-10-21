'use client';

import { motion } from 'motion/react';
import { useChat } from '@/context/ChatContext';
import { mauve } from '@/lib/theme';

// Compact card for the /projects archive. Plain by default; a link when
// `href` is given, and a button that opens EVE when `eve` is set.

type ArchiveCardProps = {
  code: string;
  title: string;
  kind: string;
  blurb: string;
  href?: string;
  /** Opens the EVE chat with the Projects context instead of linking out. */
  eve?: boolean;
  delay?: number;
};

const CARD =
  'group relative block rounded-xs border bg-black/40 backdrop-blur-md p-6 lg:p-7 transition-all duration-500';
// Border colour is animated on hover, so its base value is set inline (see lib/theme).
const CARD_STYLE = { borderColor: mauve(0.22) };
const CARD_HOVER = { borderColor: mauve(0.7), boxShadow: `0 0 28px ${mauve(0.2)}` };

export default function ArchiveCard({
  code,
  title,
  kind,
  blurb,
  href,
  eve = false,
  delay = 0,
}: ArchiveCardProps) {
  const { openChat, setContext } = useChat();

  const inner = (
    <>
      <div className="mb-3 flex items-center justify-between gap-4 text-[10px] font-mono uppercase tracking-[0.3em] text-white/50">
        <span>
          {code} · {kind}
        </span>
        {(href || eve) && (
          <span
            aria-hidden="true"
            className="text-white/70 transition-all duration-300 group-hover:translate-x-1 group-hover:text-white"
          >
            →
          </span>
        )}
      </div>
      <h3 className="font-heading text-xl md:text-2xl uppercase tracking-tight leading-snug text-white">
        {title}
      </h3>
      <p className="font-body text-base mt-3 leading-relaxed text-cream/78">{blurb}</p>
    </>
  );

  const motionProps = {
    style: CARD_STYLE,
    whileHover: CARD_HOVER,
    initial: { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: { duration: 0.6, delay },
  } as const;

  if (href) {
    return (
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={CARD}
        {...motionProps}
      >
        {inner}
      </motion.a>
    );
  }

  if (eve) {
    return (
      <motion.button
        type="button"
        onClick={() => {
          setContext('Projects');
          openChat();
        }}
        className={`${CARD} w-full cursor-pointer text-left`}
        {...motionProps}
      >
        {inner}
      </motion.button>
    );
  }

  return (
    <motion.div className={CARD} {...motionProps}>
      {inner}
    </motion.div>
  );
}
