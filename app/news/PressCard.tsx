'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { mauve } from '@/lib/theme';

type PressCardProps = {
  code: string;
  kind: string;
  source: string;
  date?: string;
  title: string;
  body: ReactNode;
  pullquote?: string;
  meta?: string;
  cta: { label: string; href: string };
  delay?: number;
};

export default function PressCard({
  code,
  kind,
  source,
  date,
  title,
  body,
  pullquote,
  meta,
  cta,
  delay = 0,
}: PressCardProps) {
  return (
    <motion.article
      className="relative rounded-xs border bg-black/40 backdrop-blur-md p-7 md:p-9 transition-all duration-500"
      // Border colour is animated below, so its base value is set here (see lib/theme).
      style={{ borderColor: mauve(0.22) }}
      whileHover={{ borderColor: mauve(0.7), boxShadow: `0 0 32px ${mauve(0.22)}` }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay }}
    >
      <div className="mb-5 flex items-center justify-between gap-4 text-[10px] font-mono uppercase tracking-[0.3em]">
        <span className="text-white/55">
          {code} · {kind} · {source}
        </span>
        {date && <span className="text-white/50">{date}</span>}
      </div>

      <h2 className="font-heading text-xl md:text-2xl lg:text-3xl uppercase tracking-tight leading-snug text-white">
        {title}
      </h2>

      <div className="font-body text-base mt-5 leading-relaxed space-y-4 text-cream/82">{body}</div>

      {pullquote && (
        <blockquote className="font-body text-base md:text-lg italic mt-6 leading-relaxed pl-5 border-l-2 border-mauve text-white">
          {pullquote}
        </blockquote>
      )}

      {meta && (
        <p className="font-mono text-[10px] tracking-[0.25em] uppercase mt-6 text-white/60">
          {meta}
        </p>
      )}

      <div className="mt-7 pt-5 border-t border-white/10">
        <a
          href={cta.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2 font-mono text-[10px] md:text-xs tracking-[0.25em] uppercase text-mauve transition-colors duration-300 hover:text-white"
        >
          <span>{cta.label}</span>
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </a>
      </div>
    </motion.article>
  );
}
