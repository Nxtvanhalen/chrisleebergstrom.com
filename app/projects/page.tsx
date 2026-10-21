import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { OG_IMAGES } from '@/app/og-image';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageCta from '@/components/PageCta';
import PageHero from '@/components/PageHero';
import ProjectCard from '@/components/ProjectCard';
import Reveal from '@/components/Reveal';
import SectionHeading from '@/components/SectionHeading';
import { cardCode, LIVE_PROJECTS } from '@/lib/projects';
import ArchiveCard from './ArchiveCard';

export const metadata: Metadata = {
  title: { absolute: 'Projects | Chris Lee Bergstrom — AI & Entertainment Tech' },
  description:
    'Selected work and project archive from Chris Lee Bergstrom: agentic AI tools, entertainment-tech systems, and live-events software. Featuring The Underground, Byte, Fuel Estimator, Beacons, EVA, and more.',
  alternates: { canonical: 'https://chrisleebergstrom.com/projects' },
  openGraph: {
    title: 'Projects | Chris Lee Bergstrom',
    description:
      'Selected work from Chris Lee Bergstrom: agentic AI tools, entertainment-tech systems, and live-events software.',
    type: 'website',
    url: 'https://chrisleebergstrom.com/projects',
    images: OG_IMAGES,
  },
  twitter: {
    card: 'summary_large_image',
    site: '@chrisleebergstrom',
    creator: '@chrisleebergstrom',
    title: 'Projects | Chris Lee Bergstrom',
    description:
      'Selected work from Chris Lee Bergstrom: agentic AI tools, entertainment-tech systems, and live-events software.',
  },
};

const projectsSchema = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Projects — Chris Lee Bergstrom',
  description:
    'Showcase of AI, entertainment-tech, and live-events projects by Chris Lee Bergstrom.',
  url: 'https://chrisleebergstrom.com/projects',
  author: {
    '@type': 'Person',
    '@id': 'https://chrisleebergstrom.com/about#person',
    name: 'Chris Lee Bergstrom',
  },
  about: {
    '@type': 'Organization',
    '@id': 'https://chrisleebergstrom.com/#organization',
    name: 'CLB Consulting',
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
        name: 'Projects',
        item: 'https://chrisleebergstrom.com/projects',
      },
    ],
  },
  hasPart: [
    {
      '@type': 'SoftwareApplication',
      name: 'The Underground',
      url: 'https://underground-venue-manager.onrender.com',
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web Browser',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description:
        'Venue-management sim in cyberpunk-noir — book bands, keep the crew right, dodge incidents, balance the books. Twenty years of running venues, turned into a game.',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Byte',
      url: 'https://firstlyte.co',
      applicationCategory: 'CommunicationApplication',
      operatingSystem: 'Web / Email',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description:
        'AI assistant that lives in your inbox. Email byte@firstlyte.co for thoughtful replies in under 30 seconds — no app, no login.',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Fuel Estimator',
      url: 'https://fuel-estimator.onrender.com',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web Browser',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description:
        'Tour-bus fuel cost calculator — estimate fuel spend across routes, miles, and price-per-gallon so tour budgets hold up before the wheels roll.',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://chrisleebergstrom.com/#beacons',
      name: 'Beacons',
      url: 'https://beaconsio.com',
      applicationCategory: 'UtilityApplication',
      operatingSystem: 'iOS / Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      provider: { '@id': 'https://chrisleebergstrom.com/#organization' },
      keywords:
        'SPL monitoring, acoustic monitoring, sound level monitoring, noise compliance, live events, Portland Oregon',
      description:
        'iPhone-based SPL and acoustic monitoring for live events. Cloud logging, real-time analysis, predictive insight. Operated by Christopher Lee Bergstrom (CLB Consulting), Portland, Oregon.',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'EVA — Events Virtual Assistant',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web Browser',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: 'Logistics, routing, and crew management AI for live events.',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'EVE',
      url: 'https://chrisleebergstrom.com',
      applicationCategory: 'Bot',
      operatingSystem: 'Web Browser',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description:
        "Conversational AI concierge for Chris Lee Bergstrom's portfolio — knows every page, project, and the work behind it.",
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Glytch',
      applicationCategory: 'UtilityApplication',
      operatingSystem: 'Local/Offline',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: 'Local offline AI experiment — no guardrails.',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'JAMES',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web Browser',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: 'Core memory and multi-agent orchestration backbone.',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'TARS',
      applicationCategory: 'UtilityApplication',
      operatingSystem: 'iOS / Local',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: 'On-device privacy-first AI.',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'LogiRoute',
      url: 'https://logi-route-a9c09ae8.base44.app',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web Browser',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: 'Touring-schedule route optimization, built in the open.',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Guardian',
      applicationCategory: 'SecurityApplication',
      operatingSystem: 'Server-side',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: 'Server-side bot protection and monitoring.',
    },
  ],
};

// Numbered after the live projects above (see the map below).
const ARCHIVE = [
  {
    title: 'EVA',
    kind: 'Events virtual assistant',
    blurb:
      "Logistics overhead reducer for crews — routing, scheduling, crew management. Doesn't replace humans, lowers their cognitive load.",
  },
  {
    title: 'EVE',
    kind: 'Portfolio concierge',
    blurb:
      "The site's own AI concierge. Knows every page, the work, the road. A working demo of the same agentic stack used to build the rest of the portfolio. Tap to start a conversation.",
    eve: true,
  },
  {
    title: 'Glytch',
    kind: 'Local AI experiment',
    blurb:
      "Local, offline, no guardrails. An ongoing test of what's possible when an LLM runs on your own machine with full freedom.",
  },
  {
    title: 'JAMES',
    kind: 'Memory backbone',
    blurb:
      'Core memory and multi-agent orchestration. Long-term context and cross-agent state so the system learns instead of forgetting.',
  },
  {
    title: 'Multi-Agent Lab',
    kind: 'Skunkworks',
    blurb:
      'Prototyping federated agents and real-time work flows. Agents talking to agents, with humans in the loop where it matters.',
  },
  {
    title: 'Sandbox',
    kind: 'Hospitality AI',
    blurb:
      'Firebase-powered demand prediction for hospitality and venue strategy. Turns sales noise into operational insight.',
  },
  {
    title: 'TARS',
    kind: 'Local privacy-first AI',
    blurb:
      'On-device intelligence — your data, your hardware, your control. Pushes the privacy ceiling for sensitive workflows.',
  },
  {
    title: 'LogiRoute',
    kind: 'Touring logistics',
    blurb:
      'Complex route optimization for touring schedules. Built in the open as a working logistics agent.',
    href: 'https://logi-route-a9c09ae8.base44.app',
  },
  {
    title: 'Guardian',
    kind: 'Web security',
    blurb:
      'Server-side bot protection and monitoring. The defense layer that keeps the surface clean.',
  },
];

export default async function ProjectsPage() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <>
      <Header />
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(projectsSchema) }}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="relative bg-black text-white outline-none"
        aria-label="Projects by Chris Lee Bergstrom"
      >
        <PageHero
          eyebrow="Projects"
          title="The Full Workshop"
          width="6xl"
          intro="The four cards on the homepage are the spine. Everything below is the archive — shipped work, internal infrastructure, and ongoing experiments. Each line a different way of asking: what does it look like when twenty years of running shows meets an AI build team?"
        />

        {/* Live spine */}
        <section className="relative px-6 py-12 md:py-16">
          <div className="mx-auto max-w-6xl">
            <SectionHeading size="sm">Live</SectionHeading>

            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
              {LIVE_PROJECTS.map((project, i) => (
                <ProjectCard key={project.title} code={cardCode(i)} project={project} />
              ))}
            </div>
          </div>
        </section>

        {/* Archive */}
        <section className="relative px-6 py-12 md:py-16 lg:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading size="sm">Archive</SectionHeading>
            <Reveal
              as="p"
              margin="-80px"
              delay={0.1}
              className="font-body text-base max-w-3xl mt-4 leading-relaxed text-cream/70"
            >
              Shipped tools, internal infrastructure, and experiments that informed the live work.
            </Reveal>

            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {ARCHIVE.map((item, i) => (
                <ArchiveCard
                  key={item.title}
                  code={cardCode(LIVE_PROJECTS.length + i)}
                  {...item}
                  delay={i * 0.05}
                />
              ))}
            </div>
          </div>
        </section>

        <PageCta heading="Something here look interesting?" subject="Project Inquiry" />
      </main>
      <Footer />
    </>
  );
}
