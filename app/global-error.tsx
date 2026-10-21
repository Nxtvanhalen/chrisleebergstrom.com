'use client';

import * as Sentry from '@sentry/nextjs';
import { Chakra_Petch, Newsreader } from 'next/font/google';
import { useEffect } from 'react';
import { MAUVE, mauve } from '@/lib/theme';

// global-error replaces the root layout entirely, so nothing from layout.tsx
// (fonts, global.css, providers) exists here. Fonts are loaded again and every
// style is inline so the page stands on its own even when the app is broken.
const chakraPetch = Chakra_Petch({ subsets: ['latin'], weight: ['600'], display: 'swap' });
const newsreader = Newsreader({ subsets: ['latin'], weight: ['400'], display: 'swap' });

const CREAM = 'rgba(245, 245, 220, 0.82)';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const buttonBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem 2.5rem',
  fontFamily: chakraPetch.style.fontFamily,
  fontWeight: 600,
  fontSize: '0.875rem',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  borderRadius: '0.125rem',
  cursor: 'pointer',
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" style={{ background: '#000' }}>
      <body
        style={{
          margin: 0,
          background: '#000',
          color: '#fff',
          fontFamily: newsreader.style.fontFamily,
        }}
      >
        <title>Something went wrong | Chris Lee Bergstrom</title>
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6rem 1.5rem',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ maxWidth: '36rem', textAlign: 'center' }}>
            <p
              style={{
                fontFamily: MONO,
                fontSize: '0.75rem',
                letterSpacing: '0.35em',
                textTransform: 'uppercase',
                color: MAUVE,
                margin: '0 0 1rem',
              }}
            >
              Error 500
            </p>
            <h1
              style={{
                fontFamily: chakraPetch.style.fontFamily,
                fontWeight: 600,
                fontSize: 'clamp(2.5rem, 8vw, 4.5rem)',
                lineHeight: 0.95,
                letterSpacing: '-0.02em',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              Something broke
            </h1>
            <p style={{ fontSize: '1.125rem', lineHeight: 1.6, color: CREAM, margin: '2rem 0 0' }}>
              The error has already been reported. Try again, or head back to the work.
            </p>
            {error.digest && (
              <p
                style={{
                  fontFamily: MONO,
                  fontSize: '0.625rem',
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color: 'rgba(255, 255, 255, 0.45)',
                  margin: '1.5rem 0 0',
                }}
              >
                Ref · {error.digest}
              </p>
            )}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                justifyContent: 'center',
                marginTop: '2.5rem',
              }}
            >
              <button
                type="button"
                onClick={reset}
                style={{
                  ...buttonBase,
                  background: MAUVE,
                  color: '#000',
                  border: 'none',
                  boxShadow: `0 0 30px ${mauve(0.4)}`,
                }}
              >
                Try again
              </button>
              {/* Plain anchor on purpose: the router may be part of what broke. */}
              <a
                href="/"
                style={{
                  ...buttonBase,
                  padding: '1rem 2rem',
                  background: 'transparent',
                  color: MAUVE,
                  border: `1px solid ${mauve(0.5)}`,
                }}
              >
                ← Back to the work
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
