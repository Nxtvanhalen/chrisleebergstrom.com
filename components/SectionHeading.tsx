import type { ReactNode } from 'react';
import Reveal from './Reveal';

// Every section title on the site. The presets carry the type scale and the
// reveal timing each context uses.
const PRESETS = {
  /** Home page sections. */
  lg: { className: 'text-4xl md:text-5xl lg:text-6xl', y: 12, duration: 0.7, delay: 0.1 },
  /** About page sections. */
  md: { className: 'text-3xl md:text-4xl lg:text-5xl', y: 12, duration: 0.7, delay: 0.05 },
  /** Sub-sections inside a page (the /projects "Live" and "Archive" groups). */
  sm: { className: 'text-2xl md:text-3xl', y: 10, duration: 0.6, delay: 0, margin: '-80px' },
} as const;

type SectionHeadingProps = {
  /** Target for the parent section's aria-labelledby. */
  id?: string;
  size?: keyof typeof PRESETS;
  children: ReactNode;
};

export default function SectionHeading({ id, size = 'lg', children }: SectionHeadingProps) {
  const { className, ...reveal } = PRESETS[size];
  return (
    <Reveal
      as="h2"
      id={id}
      className={`font-heading ${className} uppercase tracking-tight text-white`}
      {...reveal}
    >
      {children}
    </Reveal>
  );
}
