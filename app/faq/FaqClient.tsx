'use client';

import { useState } from 'react';
import PageCta from '@/components/PageCta';
import PageHero from '@/components/PageHero';
import Reveal from '@/components/Reveal';
import { FAQ_ITEMS, type FAQItem } from './faqs';

type FaqRowProps = {
  index: number;
  faq: FAQItem;
  open: boolean;
  onToggle: () => void;
};

function FaqRow({ index, faq, open, onToggle }: FaqRowProps) {
  const code = String(index + 1).padStart(2, '0');
  const buttonId = `faq-${index}-question`;
  const panelId = `faq-${index}-answer`;
  return (
    <Reveal
      y={12}
      margin="-60px"
      duration={0.45}
      delay={Math.min(index * 0.04, 0.3)}
      className="border-b border-white/10"
    >
      {/* WAI-ARIA accordion: heading > button (phrasing content only — spans, not
          <p>), aria-expanded/aria-controls on the button, a labelled region for
          the panel that is inert while collapsed. */}
      <h2>
        <button
          type="button"
          id={buttonId}
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="group w-full grid grid-cols-12 gap-4 py-6 text-left transition-colors hover:bg-white/2"
        >
          <span className="col-span-2 md:col-span-1 font-mono text-xs tracking-[0.3em] uppercase pt-1 text-mauve">
            {code}
          </span>
          <span className="col-span-9 md:col-span-10 font-heading text-base md:text-lg uppercase tracking-tight text-white">
            {faq.question}
          </span>
          <span
            aria-hidden="true"
            className={`col-span-1 flex items-start justify-end pt-1 font-mono text-base text-mauve transition-transform duration-300 ${
              open ? 'rotate-45' : ''
            }`}
          >
            +
          </span>
        </button>
      </h2>
      {/* grid-template-rows 0fr → 1fr animates to the panel's real height, so no
          max-height guess and no clipped long answers. */}
      <section
        id={panelId}
        aria-labelledby={buttonId}
        aria-hidden={!open}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-12 gap-4 pb-8">
            <div className="col-span-12 md:col-span-10 md:col-start-2 font-body text-base leading-relaxed whitespace-pre-line text-cream/82">
              {faq.answer}
              {faq.category && (
                <p className="mt-5 font-mono text-[10px] tracking-[0.3em] uppercase text-white/50">
                  {faq.category}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </Reveal>
  );
}

export default function FaqClient() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative bg-black text-white outline-none"
      aria-label="Frequently Asked Questions"
    >
      <PageHero
        eyebrow="FAQ"
        title="Frequent Questions"
        intro="Common questions about the work, the method, and the road. If yours isn't here, send a message and it might earn a row."
      />

      {/* FAQ list */}
      <section className="relative px-6 py-8 md:py-12">
        <div className="mx-auto max-w-4xl">
          <div className="border-t border-white/10">
            {FAQ_ITEMS.map((faq, index) => (
              <FaqRow
                key={faq.question}
                index={index}
                faq={faq}
                open={openIndex === index}
                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </div>
        </div>
      </section>

      <PageCta
        heading="Didn't answer your question?"
        intro="Either ask EVE in the bottom-right widget — she knows the site — or send a direct note."
        subject="FAQ Follow-up"
      />
    </main>
  );
}
