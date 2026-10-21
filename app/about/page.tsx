import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Image from 'next/image';
import { OG_IMAGES } from '@/app/og-image';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageCta from '@/components/PageCta';
import Reveal from '@/components/Reveal';
import SectionHeading from '@/components/SectionHeading';

export const metadata: Metadata = {
  title: {
    absolute: 'About | Chris Lee Bergstrom — Front-of-House Engineer Turned AI Developer',
  },
  description:
    'Origin story: 20 years in live entertainment — front of house, tour management, technical direction with The Dandy Warhols, Black Rebel Motorcycle Club, and Macklemore. Now building the software.',
  robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  authors: [{ name: 'Chris Lee Bergstrom' }],
  keywords: [
    'Chris Lee Bergstrom',
    'AI developer',
    'front-of-house engineer',
    'live sound engineer',
    'tour manager',
    'technical director',
    'agentic AI',
    'entertainment technology',
    'Dandy Warhols front of house',
    'BRMC tour manager',
    'Macklemore tour',
  ],
  alternates: { canonical: 'https://chrisleebergstrom.com/about' },
  openGraph: {
    title: 'About | Chris Lee Bergstrom',
    description:
      'Origin story: 20 years in live entertainment — front of house, tour management, technical direction. Now building the software.',
    type: 'website',
    url: 'https://chrisleebergstrom.com/about',
    images: OG_IMAGES,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About | Chris Lee Bergstrom',
    description:
      'Origin story: 20 years in live entertainment — front of house, tour management, technical direction. Now building the software.',
  },
};

const aboutSchema = {
  '@context': 'https://schema.org',
  '@type': 'ProfilePage',
  mainEntity: {
    '@type': 'Person',
    '@id': 'https://chrisleebergstrom.com/about#person',
    name: 'Chris Lee Bergstrom',
    alternateName: ['Chris Bergstrom', 'CLB'],
    jobTitle: 'AI Developer',
    description:
      'AI developer with 20 years in live entertainment. Two decades of front-of-house, tour management, and technical direction — touring with The Dandy Warhols, Black Rebel Motorcycle Club, and Macklemore. Now building software with AI agents as the build team.',
    image: 'https://chrisleebergstrom.com/images/profile/chris-profile.jpg',
    email: 'chrisleebergstrom@gmail.com',
    homeLocation: {
      '@type': 'Place',
      name: 'Portland, Oregon',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Portland',
        addressRegion: 'OR',
        addressCountry: 'US',
      },
    },
    worksFor: {
      '@type': 'Organization',
      '@id': 'https://chrisleebergstrom.com/#organization',
      name: 'CLB Consulting',
    },
    founder: {
      '@type': 'Organization',
      '@id': 'https://chrisleebergstrom.com/#organization',
      name: 'CLB Consulting',
    },
    knowsAbout: [
      'Agentic AI Development',
      'Multi-Agent Systems',
      'Live Entertainment Software',
      'Venue Operations',
      'Front-of-House Engineering',
      'Tour Management',
      'Audio Engineering',
      'SPL Monitoring',
      'Acoustic Monitoring',
      'AI Implementation',
      'Web Security',
    ],
    sameAs: [
      'https://www.linkedin.com/in/chris-bergstrom',
      'https://www.instagram.com/chrisleebergstrom',
      'https://www.youtube.com/@chrisleebergstrom',
      'https://www.facebook.com/share/15a8S2BF9S/?mibextid=wwXIfr',
      'https://github.com/Nxtvanhalen',
      'https://chrisleebergstrom.substack.com',
    ],
  },
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://chrisleebergstrom.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'About',
        item: 'https://chrisleebergstrom.com/about',
      },
    ],
  },
};

const ALIASES = [
  'AI-Native Technical Architect',
  'Agentic Development Orchestrator',
  'AI-Augmented Product Architect',
  'Context Engineer & Systems Designer',
  'Solo Technical Founder (AI-Native)',
  'Full-Stack AI Systems Builder',
];

export default async function AboutPage() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <>
      <Header />
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="relative text-white outline-none"
        aria-label="About Chris Lee Bergstrom"
      >
        {/* Hero / Intro */}
        <section className="relative px-6 pt-32 pb-16 md:pt-40 md:pb-20 lg:pt-48 lg:pb-24">
          <div className="mx-auto max-w-4xl">
            <Reveal on="mount" y={10} duration={0.7} className="flex items-center gap-5 mb-10">
              <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full border border-mauve/40 overflow-hidden shrink-0">
                <Image
                  src="/images/profile/CBAI.webp"
                  alt="Chris Lee Bergstrom"
                  fill
                  className="object-cover object-top"
                  sizes="96px"
                  priority
                />
              </div>
              <div>
                <p className="font-mono text-xs tracking-[0.35em] uppercase text-mauve">
                  Personnel
                </p>
                <h1 className="font-heading text-3xl md:text-4xl uppercase tracking-tight leading-none mt-2 text-white">
                  About
                </h1>
              </div>
            </Reveal>

            <Reveal
              as="p"
              on="mount"
              y={10}
              duration={0.8}
              delay={0.2}
              className="font-body text-lg md:text-xl leading-relaxed text-white"
            >
              A pattern-recognizing systems thinker spanning twenty-five domains, with expert depth
              in seven. I operate an AI engineering team with multi-model role specialization,
              adversarial review pipelines, and platform delegation. Fluent across the full
              generative AI spectrum. I treat architecture and context engineering as source code.
            </Reveal>

            <Reveal
              as="p"
              on="mount"
              duration={0.8}
              delay={0.35}
              className="font-body text-base md:text-lg mt-6 leading-relaxed text-cream/78"
            >
              Twenty-plus years in live entertainment — the domain expertise that makes every
              product decision credible. Building with AI since the GPT-2/3 era. I lead with{' '}
              <span className="text-mauve">"what do you think?"</span> and learn by building.
            </Reveal>
          </div>
        </section>

        {/* Philosophy */}
        <section
          id="philosophy"
          aria-labelledby="philosophy-heading"
          className="relative px-6 py-16 md:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-4xl">
            <SectionHeading id="philosophy-heading" size="md">
              Philosophy
            </SectionHeading>

            <Reveal
              as="blockquote"
              x={-10}
              margin="-80px"
              duration={0.7}
              className="mt-10 font-body text-lg md:text-xl leading-relaxed text-white border-l-2 border-mauve pl-6"
            >
              Optimizes for{' '}
              <a
                href="https://www.youtube.com/watch?v=fXIeFJCqsPs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-mauve underline decoration-1 decoration-mauve/60 underline-offset-4 transition-colors hover:text-white"
              >
                Csikszentmihalyi's Flow state
              </a>
              . The entire AI methodology is engineered to keep challenge matched to skill — agents
              handle tedium, the human stays at the architectural and creative layer.
            </Reveal>
          </div>
        </section>

        {/* AKA */}
        <section
          id="aka"
          aria-labelledby="aka-heading"
          className="relative px-6 py-16 md:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-4xl">
            <SectionHeading id="aka-heading" size="md">
              Also Known As
            </SectionHeading>

            <Reveal margin="-80px" duration={0.7} className="mt-10 flex flex-wrap gap-2">
              {ALIASES.map((alias) => (
                <span
                  key={alias}
                  className="font-mono text-[10px] md:text-xs tracking-[0.2em] uppercase px-3 py-2 rounded-xs border border-mauve/35 text-white/80"
                >
                  {alias}
                </span>
              ))}
            </Reveal>
          </div>
        </section>

        <PageCta heading="Want to work together?" subject="Project Inquiry" />
      </main>
      <Footer />
    </>
  );
}
