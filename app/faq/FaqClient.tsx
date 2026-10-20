'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import { FAQ_ITEMS, type FAQItem } from './faqs';

const VIOLET = '#9370DB';

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
    <motion.div
      className="border-b border-white/10"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.3) }}
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
          <span
            className="col-span-2 md:col-span-1 font-mono text-xs tracking-[0.3em] uppercase pt-1"
            style={{ color: VIOLET }}
          >
            {code}
          </span>
          <span className="col-span-9 md:col-span-10 font-heading text-base md:text-lg uppercase tracking-tight text-white">
            {faq.question}
          </span>
          <span
            aria-hidden="true"
            className={`col-span-1 flex items-start justify-end pt-1 font-mono text-base transition-transform duration-300 ${
              open ? 'rotate-45' : ''
            }`}
            style={{ color: VIOLET }}
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
            <div
              className="col-span-12 md:col-span-10 md:col-start-2 font-body text-base leading-relaxed whitespace-pre-line"
              style={{ color: 'rgba(245, 245, 220, 0.82)' }}
            >
              {faq.answer}
              {faq.category && (
                <p className="mt-5 font-mono text-[10px] tracking-[0.3em] uppercase text-white/45">
                  {faq.category}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}

export default function FaqClient() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <main
      id="main-content"
      className="relative bg-black text-white"
      aria-label="Frequently Asked Questions"
    >
      {/* Header */}
      <section className="relative px-6 pt-32 pb-12 md:pt-40 md:pb-16 lg:pt-48 lg:pb-20">
        <div className="mx-auto max-w-4xl">
          <motion.p
            className="font-mono text-xs tracking-[0.35em] uppercase mb-4"
            style={{ color: VIOLET }}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            FAQ
          </motion.p>
          <motion.h1
            className="font-heading text-4xl md:text-5xl lg:text-6xl uppercase tracking-tight text-white"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            Frequent Questions
          </motion.h1>
          <motion.p
            className="font-body text-base md:text-lg lg:text-xl max-w-3xl mt-6 leading-relaxed"
            style={{ color: 'rgba(245, 245, 220, 0.82)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            Common questions about the work, the method, and the road. If yours isn't here, send a
            message and it might earn a row.
          </motion.p>
        </div>
      </section>

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

      {/* CTA */}
      <section className="relative px-6 py-16 md:py-20 lg:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <motion.h2
            className="font-heading text-3xl md:text-4xl uppercase tracking-tight text-white"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
          >
            Didn't answer your question?
          </motion.h2>
          <motion.p
            className="font-body text-base md:text-lg max-w-2xl mx-auto mt-6 leading-relaxed"
            style={{ color: 'rgba(245, 245, 220, 0.78)' }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Either ask EVE in the bottom-right widget — she knows the site — or send a direct note.
          </motion.p>
          <motion.div
            className="mt-8 flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <a
              href="mailto:chrisleebergstrom@gmail.com?subject=FAQ%20Follow-up"
              className="group inline-flex items-center justify-center gap-3 px-10 py-4 font-heading text-sm tracking-[0.15em] uppercase rounded-xs transition-all duration-300"
              style={{
                background: VIOLET,
                color: '#000',
                boxShadow: '0 0 30px rgba(147, 112, 219, 0.4)',
              }}
            >
              Send a message
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </a>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-8 py-4 font-heading text-sm tracking-[0.15em] uppercase rounded-xs border transition-all duration-300 hover:bg-white/5"
              style={{
                borderColor: 'rgba(147, 112, 219, 0.5)',
                color: VIOLET,
              }}
            >
              ← Back to the work
            </Link>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
