'use client';

import { motion, type TargetAndTransition } from 'motion/react';
import type { ReactNode } from 'react';

// The one fade-in used by every section. Keeping it in a single client
// component lets the sections themselves stay server components. Reduced
// motion is handled by MotionProvider (MotionConfig reducedMotion="user"):
// the offset is skipped, the opacity fade still runs.

const TAGS = {
  div: motion.div,
  p: motion.p,
  h1: motion.h1,
  h2: motion.h2,
  blockquote: motion.blockquote,
} as const;

type RevealProps = {
  as?: keyof typeof TAGS;
  /** `view` fades in once the element scrolls into view; `mount` on first render (above-the-fold heroes). */
  on?: 'view' | 'mount';
  /** Starting offset in px; the element always fades from opacity 0 as well. */
  x?: number;
  y?: number;
  delay?: number;
  duration?: number;
  /** Root margin for the in-view trigger — negative values wait until the element is well inside the viewport. */
  margin?: `${number}px`;
  id?: string;
  className?: string;
  children: ReactNode;
};

export default function Reveal({
  as = 'div',
  on = 'view',
  x = 0,
  y = 0,
  delay = 0,
  duration = 0.6,
  margin = '-100px',
  id,
  className,
  children,
}: RevealProps) {
  const Tag = TAGS[as];
  const hidden: TargetAndTransition = { opacity: 0 };
  const shown: TargetAndTransition = { opacity: 1 };
  if (x) {
    hidden.x = x;
    shown.x = 0;
  }
  if (y) {
    hidden.y = y;
    shown.y = 0;
  }
  const transition = { duration, delay };

  if (on === 'mount') {
    return (
      <Tag id={id} className={className} initial={hidden} animate={shown} transition={transition}>
        {children}
      </Tag>
    );
  }
  return (
    <Tag
      id={id}
      className={className}
      initial={hidden}
      whileInView={shown}
      viewport={{ once: true, margin }}
      transition={transition}
    >
      {children}
    </Tag>
  );
}
