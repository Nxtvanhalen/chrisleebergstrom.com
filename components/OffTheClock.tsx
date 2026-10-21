'use client';

import { motion } from 'motion/react';
import Image from 'next/image';
import { useChat } from '@/context/ChatContext';
import { SUBSTACK_URL } from '@/lib/site';
import { mauve } from '@/lib/theme';
import Reveal from './Reveal';
import SectionHeading from './SectionHeading';

// Shared by both cards. The border colour is animated on hover, so its base
// value is set inline (see lib/theme).
// Hover is CSS only (see ProjectCard); motion just runs the reveal.
const CARD =
  'group relative block overflow-hidden rounded-xs border bg-black/40 backdrop-blur-md transition-[border-color,box-shadow] duration-300 border-mauve/22 hover:border-mauve/70 hover:shadow-[0_0_28px_rgba(147,112,219,0.22)]';
const HOVER_WASH = { background: `linear-gradient(180deg, ${mauve(0)} 60%, ${mauve(0.18)} 100%)` };

export default function OffTheClock() {
  const { toggleChat } = useChat();

  return (
    <section
      id="offclock"
      aria-labelledby="offclock-heading"
      className="relative px-6 py-12 md:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading id="offclock-heading">Off the Clock</SectionHeading>

        <Reveal
          as="p"
          duration={0.7}
          delay={0.2}
          className="font-body text-base md:text-lg max-w-2xl mt-6 leading-relaxed text-cream/72"
        >
          Same brain, different mediums.
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
          <motion.a
            href={`${SUBSTACK_URL}/p/the-archivist`}
            target="_blank"
            rel="noopener noreferrer"
            className={CARD}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
          >
            <div className="relative aspect-video w-full overflow-hidden bg-black">
              <Image
                src="/images/SciFi-Chroma-Moonscape-04.png"
                alt="The Archivists — surreal moonscape with twin moons rising over a chroma-streaked desert horizon"
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                sizes="(min-width: 768px) 50vw, 100vw"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={HOVER_WASH}
              />
            </div>

            <div className="p-7 lg:p-10">
              <p className="font-mono text-xs tracking-[0.35em] uppercase mb-6 text-mauve">
                Substack · Serialized novella
              </p>
              <h3 className="font-heading text-2xl md:text-3xl uppercase tracking-tight text-white">
                The Archivists
              </h3>
              <p className="font-body text-base mt-5 leading-relaxed text-cream/82">
                A serialized novella, in progress. Same brain that built the live shows and the
                software — different medium, closer to where the fiction was always headed.
              </p>
              <p className="mt-6 font-mono text-[10px] tracking-[0.25em] uppercase text-white/70 transition-colors group-hover:text-white">
                Read on Substack →
              </p>
            </div>
          </motion.a>

          <motion.button
            type="button"
            onClick={toggleChat}
            className={`${CARD} text-left w-full cursor-pointer`}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div
              className="relative aspect-video w-full overflow-hidden"
              style={{
                background: `radial-gradient(ellipse at center, ${mauve(0.15)} 0%, #000 70%)`,
              }}
            >
              {/* Blurred backdrop copy — fills the frame behind the sharp version.
                  scale(1.08) prevents the blur from showing its own edge as a soft ring. */}
              <Image
                src="/images/EVEP.png"
                alt=""
                aria-hidden="true"
                fill
                className="object-contain pointer-events-none blur-[18px] saturate-[1.1] scale-[1.08] opacity-85"
                sizes="(min-width: 768px) 50vw, 100vw"
              />

              {/* Sharp foreground — the radial mask fades to transparent at the borders,
                  revealing the blurred copy beneath and giving the soft-edge halo effect. */}
              <Image
                src="/images/EVEP.png"
                alt="EVE — the site's AI concierge"
                fill
                className="object-contain transition-transform duration-700 group-hover:scale-[1.03]"
                sizes="(min-width: 768px) 50vw, 100vw"
                style={{
                  mask: 'radial-gradient(ellipse 70% 80% at center, black 30%, transparent 95%)',
                  WebkitMask:
                    'radial-gradient(ellipse 70% 80% at center, black 30%, transparent 95%)',
                }}
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={HOVER_WASH}
              />
            </div>

            <div className="p-7 lg:p-10">
              <p className="font-mono text-xs tracking-[0.35em] uppercase mb-6 text-mauve">
                Working demo · AI concierge
              </p>
              <h3 className="font-heading text-2xl md:text-3xl uppercase tracking-tight text-white">
                EVE
              </h3>
              <p className="font-body text-base mt-5 leading-relaxed text-cream/82">
                The site's own AI concierge. Knows the work, the road, and how to reach me. Not a
                widget — a working demo of how the build process actually runs.
              </p>
              <p className="mt-6 font-mono text-[10px] tracking-[0.25em] uppercase text-white/70 transition-colors group-hover:text-white">
                Open the chat →
              </p>
            </div>
          </motion.button>
        </div>
      </div>
    </section>
  );
}
