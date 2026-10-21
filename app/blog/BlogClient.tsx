'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import PageCta from '@/components/PageCta';
import PageHero from '@/components/PageHero';
import Reveal from '@/components/Reveal';
import { mailto, SUBSTACK_URL } from '@/lib/site';

interface SubstackPost {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
  author: string;
}

interface SubstackFeed {
  success: boolean;
  posts: SubstackPost[];
  feedTitle?: string;
  feedDescription?: string;
  error?: string;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Substack's RSS gives RFC-822 pubDates ("Tue, 07 Oct 2025 14:00:00 GMT");
// <time dateTime> wants ISO 8601, so convert and drop the attribute if unparseable.
function toIsoDate(dateString: string): string | undefined {
  const time = Date.parse(dateString);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

const SUBSTACK_LINK =
  'inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-mauve transition-colors hover:text-white';

type PostCardProps = {
  code: string;
  post: SubstackPost;
  delay?: number;
};

function PostCard({ code, post, delay = 0 }: PostCardProps) {
  return (
    <motion.a
      href={post.link}
      target="_blank"
      rel="noopener noreferrer"
      // Hover is CSS only (see ProjectCard); motion just runs the reveal.
      className="group relative block rounded-xs border bg-black/40 backdrop-blur-md p-6 lg:p-7 transition-[border-color,box-shadow] duration-300 border-mauve/22 hover:border-mauve/70 hover:shadow-[0_0_28px_rgba(147,112,219,0.22)]"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay }}
    >
      <div className="mb-3 flex items-center justify-between gap-4 text-[10px] font-mono uppercase tracking-[0.3em]">
        <span className="text-white/55">{code} · Musing</span>
        <time className="text-white/50" dateTime={toIsoDate(post.pubDate)}>
          {formatDate(post.pubDate)}
        </time>
      </div>

      <h3 className="font-heading text-xl md:text-2xl uppercase tracking-tight leading-snug text-white">
        {post.title}
      </h3>

      {post.contentSnippet && (
        <p className="font-body text-base mt-4 leading-relaxed text-cream/78">
          {post.contentSnippet}
        </p>
      )}

      <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between font-mono text-[10px] tracking-[0.25em] uppercase">
        <span className="inline-flex items-center gap-2 text-mauve transition-all duration-300 group-hover:gap-3">
          Read on Substack
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </span>
        {post.author && <span className="text-white/50">by {post.author}</span>}
      </div>
    </motion.a>
  );
}

export default function BlogClient() {
  const [substackPosts, setSubstackPosts] = useState<SubstackPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubstackPosts = async () => {
      try {
        const response = await fetch('/api/substack');
        const data: SubstackFeed = await response.json();

        if (data.success) {
          setSubstackPosts(data.posts);
        } else {
          setError(data.error || 'Failed to load posts');
        }
      } catch (err) {
        setError('Failed to fetch posts');
        console.error('Error fetching Substack posts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubstackPosts();
  }, []);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative bg-black text-white outline-none"
      aria-label="Musings — blog and Substack feed"
    >
      <PageHero
        eyebrow="Musings"
        title="From the Substack"
        intro={
          <>
            Unfiltered notes on agentic AI, live entertainment, and systems thinking. Plus{' '}
            <a
              href={`${SUBSTACK_URL}/p/the-archivist`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-mauve underline decoration-1 underline-offset-4 transition-colors hover:text-white"
            >
              The Archivists
            </a>{' '}
            — a serialized novella in progress.
          </>
        }
      />

      {/* Feed */}
      <section className="relative px-6 py-8 md:py-12">
        <div className="mx-auto max-w-4xl">
          {loading && (
            <div className="py-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-mauve border-r-transparent" />
              <p className="mt-4 font-mono text-[10px] tracking-[0.3em] uppercase text-white/50">
                Loading latest posts
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xs border border-[rgba(248,113,113,0.35)] bg-black/40 backdrop-blur-md p-7 text-center">
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase mb-4 text-white/60">
                Feed unavailable
              </p>
              <p className="font-body text-base mb-5 leading-relaxed text-cream/78">{error}</p>
              <a
                href={SUBSTACK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={SUBSTACK_LINK}
              >
                Visit Substack directly →
              </a>
            </div>
          )}

          {!loading && !error && substackPosts.length > 0 && (
            <div className="space-y-5 md:space-y-6">
              {substackPosts.map((post, index) => (
                <PostCard
                  key={post.link || index}
                  code={String(index + 1).padStart(2, '0')}
                  post={post}
                  delay={Math.min(index * 0.05, 0.3)}
                />
              ))}
            </div>
          )}

          {!loading && !error && substackPosts.length === 0 && (
            <div className="py-12 text-center">
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase mb-4 text-white/50">
                Quiet here
              </p>
              <p className="font-body text-base mb-6 text-cream/78">New posts coming soon.</p>
              <a
                href={SUBSTACK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={SUBSTACK_LINK}
              >
                Subscribe on Substack →
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Subscribe + CTA combined */}
      <PageCta
        heading="Subscribe or send a note"
        intro="Subscribing gets the musings and The Archivists straight to your inbox. Want to push back on something or take an idea further? Send a message instead."
        primary={{ label: 'Subscribe on Substack', href: SUBSTACK_URL, external: true }}
        secondary={{ label: 'Send a note', href: mailto('Musings Discussion') }}
      >
        <Reveal
          as="p"
          margin="-60px"
          delay={0.3}
          className="mt-10 font-mono text-[10px] tracking-[0.3em] uppercase text-white/50"
        >
          <Link href="/" className="transition-colors hover:text-white">
            ← Back to the work
          </Link>
        </Reveal>
      </PageCta>
    </main>
  );
}
