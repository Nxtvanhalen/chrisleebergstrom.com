import type { ReactNode } from 'react';
import Reveal from './Reveal';

// Eyebrow + H1 + intro that opens every deep page. Fades in on mount rather
// than on scroll because it is always above the fold.

const WIDTHS = {
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '6xl': 'max-w-6xl',
} as const;

type PageHeroProps = {
  eyebrow: string;
  title: string;
  /** Body-copy intro under the title. */
  intro?: ReactNode;
  /** Anything else under the title, already wrapped in its own <Reveal>. */
  children?: ReactNode;
  width?: keyof typeof WIDTHS;
  /** Shorter bottom spacing on large screens (the privacy policy). */
  compact?: boolean;
};

export default function PageHero({
  eyebrow,
  title,
  intro,
  children,
  width = '4xl',
  compact = false,
}: PageHeroProps) {
  return (
    <section
      className={`relative px-6 pt-32 pb-12 md:pt-40 md:pb-16 ${compact ? '' : 'lg:pt-48 lg:pb-20'}`}
    >
      <div className={`mx-auto ${WIDTHS[width]}`}>
        <Reveal
          as="p"
          on="mount"
          y={-6}
          className="font-mono text-xs tracking-[0.35em] uppercase mb-4 text-mauve"
        >
          {eyebrow}
        </Reveal>
        <Reveal
          as="h1"
          on="mount"
          y={12}
          duration={0.7}
          delay={0.1}
          className="font-heading text-4xl md:text-5xl lg:text-6xl uppercase tracking-tight text-white"
        >
          {title}
        </Reveal>
        {intro && (
          <Reveal
            as="p"
            on="mount"
            duration={0.7}
            delay={0.2}
            className="font-body text-base md:text-lg lg:text-xl max-w-3xl mt-6 leading-relaxed text-cream/82"
          >
            {intro}
          </Reveal>
        )}
        {children}
      </div>
    </section>
  );
}
