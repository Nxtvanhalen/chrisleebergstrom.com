import Link from 'next/link';
import type { ReactNode } from 'react';
import { mailto } from '@/lib/site';
import Reveal from './Reveal';

// Closing call-to-action on every deep page: heading, optional intro, a solid
// violet primary button and an outlined secondary. Defaults to "Send a message"
// (mailto with the page's subject line) and "← Back to the work".

export const CTA_PRIMARY =
  'group inline-flex items-center justify-center gap-3 px-10 py-4 font-heading text-sm tracking-[0.15em] uppercase rounded-xs bg-mauve text-black shadow-[0_0_30px_rgba(147,112,219,0.4)] transition-all duration-300';

export const CTA_SECONDARY =
  'inline-flex items-center justify-center px-8 py-4 font-heading text-sm tracking-[0.15em] uppercase rounded-xs border border-mauve/50 text-mauve transition-all duration-300 hover:bg-white/5';

type CtaLink = {
  label: string;
  href: string;
  /** Open in a new tab (off-site destinations). */
  external?: boolean;
};

type PageCtaProps = {
  heading: string;
  intro?: string;
  /** Subject line for the default mailto primary button. */
  subject?: string;
  primary?: CtaLink;
  secondary?: CtaLink;
  /** Rendered under the buttons, inside the centred column. */
  children?: ReactNode;
};

function CtaAnchor({
  link,
  className,
  children,
}: {
  link: CtaLink;
  className: string;
  children: ReactNode;
}) {
  if (link.href.startsWith('/')) {
    return (
      <Link href={link.href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={link.href}
      className={className}
      {...(link.external && { target: '_blank', rel: 'noopener noreferrer' })}
    >
      {children}
    </a>
  );
}

export default function PageCta({
  heading,
  intro,
  subject,
  primary = { label: 'Send a message', href: mailto(subject) },
  secondary = { label: '← Back to the work', href: '/' },
  children,
}: PageCtaProps) {
  return (
    <section className="relative px-6 py-16 md:py-20 lg:py-24">
      <div className="mx-auto max-w-4xl text-center">
        <Reveal
          as="h2"
          y={10}
          margin="-80px"
          className="font-heading text-3xl md:text-4xl uppercase tracking-tight text-white"
        >
          {heading}
        </Reveal>
        {intro && (
          <Reveal
            as="p"
            margin="-80px"
            delay={0.1}
            className="font-body text-base md:text-lg max-w-2xl mx-auto mt-6 leading-relaxed text-cream/78"
          >
            {intro}
          </Reveal>
        )}
        <Reveal
          margin="-80px"
          delay={intro ? 0.2 : 0.15}
          className="mt-8 flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <CtaAnchor link={primary} className={CTA_PRIMARY}>
            {primary.label}
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </CtaAnchor>
          <CtaAnchor link={secondary} className={CTA_SECONDARY}>
            {secondary.label}
          </CtaAnchor>
        </Reveal>
        {children}
      </div>
    </section>
  );
}
