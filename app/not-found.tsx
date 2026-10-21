import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { CTA_PRIMARY, CTA_SECONDARY } from '@/components/PageCta';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: 'noindex',
};

export default function NotFound() {
  return (
    <>
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        className="relative min-h-screen bg-black text-white flex items-center justify-center px-6 pt-32 pb-16 outline-none"
        aria-label="Page not found"
      >
        <div className="mx-auto max-w-xl text-center">
          <p className="font-mono text-xs tracking-[0.35em] uppercase mb-4 text-mauve">Error 404</p>
          <h1 className="font-heading text-5xl md:text-7xl uppercase tracking-tight leading-[0.95] text-white">
            Nothing at
            <br />
            this address
          </h1>
          <p className="font-body text-base md:text-lg mt-8 leading-relaxed text-cream/82">
            That page doesn't exist (or never did). The work is still where it was.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/" className={CTA_PRIMARY}>
              ← Back to the work
            </Link>
            <Link href="/projects" className={CTA_SECONDARY}>
              See the projects
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
