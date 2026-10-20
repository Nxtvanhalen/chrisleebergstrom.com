import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '../components/Footer';
import Header from '../components/Header';

const VIOLET = '#9370DB';

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
        className="relative min-h-screen bg-black text-white flex items-center justify-center px-6 pt-32 pb-16"
        aria-label="Page not found"
      >
        <div className="mx-auto max-w-xl text-center">
          <p
            className="font-mono text-xs tracking-[0.35em] uppercase mb-4"
            style={{ color: VIOLET }}
          >
            Error 404
          </p>
          <h1 className="font-heading text-5xl md:text-7xl uppercase tracking-tight leading-[0.95] text-white">
            Nothing at
            <br />
            this address
          </h1>
          <p
            className="font-body text-base md:text-lg mt-8 leading-relaxed"
            style={{ color: 'rgba(245, 245, 220, 0.82)' }}
          >
            That page doesn't exist (or never did). The work is still where it was.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-3 px-10 py-4 font-heading text-sm tracking-[0.15em] uppercase rounded-xs transition-all duration-300"
              style={{
                background: VIOLET,
                color: '#000',
                boxShadow: '0 0 30px rgba(147, 112, 219, 0.4)',
              }}
            >
              ← Back to the work
            </Link>
            <Link
              href="/projects"
              className="inline-flex items-center justify-center px-8 py-4 font-heading text-sm tracking-[0.15em] uppercase rounded-xs border transition-all duration-300 hover:bg-white/5"
              style={{
                borderColor: 'rgba(147, 112, 219, 0.5)',
                color: VIOLET,
              }}
            >
              See the projects
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
