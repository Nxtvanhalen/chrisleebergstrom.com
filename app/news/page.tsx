import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { OG_IMAGES } from '@/app/og-image';
import ChatContextSetter from '@/components/ChatContextSetter';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageCta from '@/components/PageCta';
import PageHero from '@/components/PageHero';
import Reveal from '@/components/Reveal';
import PressCard from './PressCard';

export const metadata: Metadata = {
  title: { absolute: 'News & Press | Chris Lee Bergstrom' },
  description:
    'Press coverage, podcast appearances, and music/video credits featuring Chris Lee Bergstrom — AI developer and 20-year live entertainment veteran.',
  alternates: { canonical: 'https://chrisleebergstrom.com/news' },
  openGraph: {
    title: 'News | Chris Lee Bergstrom',
    description: 'Press coverage, podcast appearances, and credits featuring Chris Lee Bergstrom.',
    type: 'website',
    url: 'https://chrisleebergstrom.com/news',
    images: OG_IMAGES,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'News | Chris Lee Bergstrom',
    description: 'Press coverage, podcast appearances, and credits featuring Chris Lee Bergstrom.',
  },
};

const newsSchema = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'News & Press — Chris Lee Bergstrom',
  description: 'Latest news, press coverage, and media appearances featuring Chris Lee Bergstrom',
  url: 'https://chrisleebergstrom.com/news',
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
        name: 'News/Press',
        item: 'https://chrisleebergstrom.com/news',
      },
    ],
  },
};

export default async function NewsPage() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <>
      <Header />
      <ChatContextSetter context="News" />
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newsSchema) }}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="relative bg-black text-white outline-none"
        aria-label="News and Press"
      >
        <PageHero
          eyebrow="Press"
          title="News & Press"
          intro="Podcast appearances, mixing-philosophy interviews, live recordings, and the credits that came out of the road work."
        />

        {/* Cards */}
        <section className="relative px-6 py-8 md:py-12">
          <div className="mx-auto max-w-4xl space-y-6 md:space-y-8">
            <PressCard
              code="01"
              kind="Podcast"
              source="Spotify"
              title="Performance Anxiety Podcast — behind the scenes of touring"
              body={
                <>
                  <p>
                    Chris joins host Adam Grimm for a long-form conversation on what it actually
                    takes to keep a tour moving: load-ins, front-of-house, tour management, the
                    difference between a domestic run and an overseas one.
                  </p>
                  <p>
                    Bands and rooms mentioned: The Dandy Warhols, Black Rebel Motorcycle Club, Tracy
                    Lawrence, the Oregon Symphony.
                  </p>
                  <p>
                    Honest on the harder parts too — touring's old stereotype, what's actually
                    changed, and the part nobody warns you about: acclimating back to normal life
                    after the bus stops.
                  </p>
                </>
              }
              cta={{
                label: 'Listen on Spotify',
                href: 'https://open.spotify.com/episode/4IKQSQspGrdKMzGoublusH',
              }}
              delay={0}
            />

            <PressCard
              code="02"
              kind="Live recording"
              source="Bandcamp"
              date="2020"
              title='The Dandy Warhols — "Warhol Wednesday Endless Live Album"'
              body={
                <p>
                  A never-ending live album. Every Wednesday subscribers get a new live song from a
                  past performance in a different city — a living archive that keeps growing week
                  after week.
                </p>
              }
              meta="Recorded live, mixed, and mastered by Chris Bergstrom · Band: Courtney Taylor Taylor, Peter Holmström, Zia McCabe, Brent DeBoer"
              cta={{
                label: 'Listen on Bandcamp',
                href: 'https://thedandywarholsofficial.bandcamp.com/album/warhol-wednesday-endless-live-album',
              }}
              delay={0.05}
            />

            <PressCard
              code="03"
              kind="Music video"
              source="YouTube"
              title='The Dandy Warhols — "Next Thing I Know" (official music video)'
              body={
                <p>
                  Off the band's 2019 album <em>Why You So Crazy</em>. Their current LP{' '}
                  <em>ROCKMAKER</em> is out on Sunset Blvd Records.
                </p>
              }
              meta="Edited by Chris Bergstrom with Ticky Hambly"
              cta={{
                label: 'Watch on YouTube',
                href: 'https://youtu.be/4WOSPFjKH3Y?si=L8scdGw4JsCyGqol',
              }}
              delay={0.1}
            />

            <PressCard
              code="04"
              kind="Feature"
              source="Mix Online"
              date="January 21, 2022"
              title="Chris Bergstrom assembles a Campfire Audio toolkit for mixing on and off-stage"
              body={
                <>
                  <p>
                    Nearly two decades of mixing live sound — The Dandy Warhols, the Oregon Symphony
                    — and a working setup built around Campfire Audio in-ear monitors for consistent
                    monitoring across very different rooms.
                  </p>
                  <p>
                    The piece runs through virtual playback during soundchecks, the Solstice and
                    Equinox IEMs for different scenarios, and the shift from speakers to in-ears for
                    studio work during quarantine.
                  </p>
                </>
              }
              pullquote="I don't believe audio engineers should insert much of themselves in the project. Accurate audio is what I need."
              cta={{
                label: 'Read on Mix Online',
                href: 'https://www.mixonline.com/the-wire/chris-bergstrom-assembles-campfire-audio-toolkit-for-mixing-on-and-off-stage',
              }}
              delay={0.15}
            />

            <PressCard
              code="05"
              kind="Interview"
              source="MusicRadar"
              date="June 24, 2021"
              title="Sound advice and mixing know-how from pro engineer Chris Bergstrom"
              body={
                <p>
                  Mixing techniques from years of live and studio work — the importance of accurate
                  monitoring, the collaborative process between engineer and artist, and the skills
                  that translate from the road into the studio.
                </p>
              }
              cta={{
                label: 'Read on MusicRadar',
                href: 'https://www.musicradar.com/news/sound-advice-and-mixing-know-how-from-pro-engineer-chris-bergstrom',
              }}
              delay={0.2}
            />

            <Reveal
              as="p"
              margin="-60px"
              className="text-center font-mono text-[10px] tracking-[0.3em] uppercase pt-8 text-white/50"
            >
              More press coverage on the way
            </Reveal>
          </div>
        </section>

        <PageCta heading="Need a quote or want to talk shop?" subject="Press Inquiry" />
      </main>
      <Footer />
    </>
  );
}
