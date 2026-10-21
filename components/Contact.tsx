import { CONTACT_EMAIL, mailto } from '@/lib/site';
import { CTA_PRIMARY } from './PageCta';
import Reveal from './Reveal';
import SectionHeading from './SectionHeading';

export default function Contact() {
  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="relative px-6 py-12 md:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-4xl text-center">
        <SectionHeading id="contact-heading">Contact</SectionHeading>

        <Reveal
          as="p"
          duration={0.7}
          delay={0.2}
          className="font-body text-lg md:text-xl mt-8 leading-relaxed max-w-2xl mx-auto text-cream/85"
        >
          Got a project, a venue, a tour, an idea worth building? Send a note. Real replies, real
          fast.
        </Reveal>

        <Reveal
          y={10}
          delay={0.3}
          className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <a href={mailto('Project Inquiry')} className={CTA_PRIMARY}>
            Send a message
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </a>
        </Reveal>

        <Reveal
          as="p"
          delay={0.4}
          className="mt-6 font-mono text-xs tracking-[0.3em] uppercase text-white/55"
        >
          {CONTACT_EMAIL}
        </Reveal>

        <Reveal
          as="p"
          margin="-80px"
          delay={0.5}
          className="mt-20 font-body text-sm md:text-base leading-relaxed max-w-2xl mx-auto text-cream/55"
        >
          Also consult on venue operations, AI training, and web security — ask if it's relevant.
        </Reveal>
      </div>
    </section>
  );
}
