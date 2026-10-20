'use client';

import { MotionConfig } from 'motion/react';

// Site-wide: every `motion` component honours prefers-reduced-motion
// (transform/layout tweens are skipped; opacity and colour still animate).
// Lives in its own client component so the root layout can stay a server
// component.
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
