'use client';

import { motion } from 'motion/react';
import Image from 'next/image';
import type { Project } from '@/lib/projects';
import { mauve } from '@/lib/theme';

// Live-project card: artwork, "Live" badge, title, blurb and a stat line.
// `featured` is the larger home-page variant; /projects uses the default.

type ProjectCardProps = {
  /** Two-digit eyebrow index ("01"). */
  code: string;
  project: Project;
  variant?: 'featured' | 'standard';
};

export default function ProjectCard({ code, project, variant = 'standard' }: ProjectCardProps) {
  const { title, kind, blurb, stat, href, image } = project;
  const featured = variant === 'featured';

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      // Hover is plain CSS so it runs one transition, at the same speed in and out;
      // motion only handles the scroll-in reveal. (Animating hover in motion as well
      // as `transition-all` made the two fight: a laggy double ease on every move.)
      className="group relative block overflow-hidden rounded-xs border border-mauve/25 bg-black/40 backdrop-blur-md transition-[scale,border-color,box-shadow] duration-300 hover:border-mauve/90 hover:shadow-[0_0_40px_rgba(147,112,219,0.35)] motion-safe:hover:scale-[1.01]"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7 }}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <div
          className="relative h-full w-full"
          style={
            image.glow
              ? { background: `radial-gradient(ellipse at center, ${mauve(0.18)} 0%, #000 70%)` }
              : undefined
          }
        >
          <Image
            src={image.src}
            alt={image.alt}
            fill
            className={image.fit === 'cover' ? 'object-cover' : 'object-contain'}
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
        </div>
        {/* Hover wash — barely-there violet across the visual */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: `linear-gradient(180deg, ${mauve(0)} 60%, ${mauve(0.15)} 100%)` }}
        />
      </div>

      <div className="p-6 lg:p-8">
        <div className="mb-4 flex items-center justify-between gap-4 text-[10px] font-mono uppercase tracking-[0.3em]">
          <span className="text-white/50">
            {code} · {kind}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xs border border-mauve px-2 py-1 text-[9px] font-bold text-mauve">
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-mauve shadow-[0_0_6px_var(--color-mauve)]"
            />
            Live
          </span>
        </div>

        <h3
          className={`font-heading ${featured ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl'} uppercase tracking-tight leading-none text-white`}
        >
          {title}
        </h3>

        <p
          className={`font-body ${featured ? 'text-base md:text-lg' : 'text-base'} mt-5 leading-relaxed text-cream/82`}
        >
          {blurb}
        </p>

        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-[10px] font-mono uppercase tracking-[0.25em]">
          <span className="text-mauve">{stat}</span>
          <span
            className="inline-flex items-center gap-2 text-white/70 transition-all duration-300 group-hover:gap-3 group-hover:text-white"
            aria-hidden="true"
          >
            Visit
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </span>
        </div>
      </div>
    </motion.a>
  );
}
