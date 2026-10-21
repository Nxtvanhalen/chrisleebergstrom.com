import type { Metadata, Viewport } from 'next';
import { Chakra_Petch, JetBrains_Mono, Newsreader } from 'next/font/google';
import { headers } from 'next/headers';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import CookieConsentLoader from '@/components/CookieConsentLoader';
import MotionProvider from '@/components/MotionProvider';
import PersistentChat from '@/components/PersistentChat';
import { ChatProvider } from '@/context/ChatContext';
import { OG_IMAGES } from './og-image';
import '@/styles/global.css';

// Plausible Analytics — privacy-first, cookieless, and consent-free, so unlike
// GA (which is gated behind CookieConsentLoader) it runs for every visitor.
// Loaded in production only. New per-site Plausible script — this URL is unique
// to the chrisleebergstrom.com site (Plausible → Site Settings → General →
// Site Installation).
const PLAUSIBLE_SRC = 'https://plausible.io/js/pa-MldANz3p0vcZConl9x759.js';
const isProd = process.env.NODE_ENV === 'production';

// Only the weights the site actually renders are loaded; next/font preloads
// every file it is given, so unused weights cost real bytes.
//   Chakra Petch (headings): 400 everywhere, 500 drawer "Connect" label, 600 drawer links.
//   Newsreader (body): 400, 500 (chat tooltip), 700 (<strong>, chat labels); 400 italic for <em>.
//   JetBrains Mono: 400, and 600 for the bold "Live" badge.
const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-chakra-petch',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://chrisleebergstrom.com'),
  title: {
    default: 'Chris Lee Bergstrom — AI Developer + 20 Years Live Entertainment',
    template: '%s | Chris Lee Bergstrom',
  },
  description:
    'AI developer with 20 years in live entertainment. Building agentic software for venues, tours, and live events — front-of-house engineer turned full-stack developer, using AI agents as the build team.',
  // Site-wide fallback share image. Without one, any page missing its own
  // openGraph.images makes link previews (iMessage etc.) scrape the page and
  // pick the transparent header logo, which renders on a checkerboard.
  // Pages that set their own `openGraph` must repeat it (see og-image.ts).
  openGraph: {
    images: OG_IMAGES,
  },
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/images/Favicon/favicon.ico' },
      { url: '/images/Favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/images/Favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      {
        url: '/images/Favicon/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/images/Favicon/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    apple: { url: '/images/Favicon/apple-touch-icon.png', sizes: '180x180' },
  },
  other: {
    'msapplication-TileColor': '#000000',
  },
};

// Defined once here — pages inherit it. Matches theme_color in
// public/site.webmanifest; the two used to disagree (#000000 vs #9370DB).
export const viewport: Viewport = {
  themeColor: '#9370DB',
  width: 'device-width',
  initialScale: 1,
};

// Force every route to render dynamically per request so framework scripts get the
// per-request nonce from proxy.ts. Without this, statically prerendered pages would
// ship unnonced <script> tags and all framework JS would be blocked by 'strict-dynamic'.
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request nonce threaded through by proxy.ts — required so the Plausible
  // <script> tags satisfy the 'strict-dynamic' CSP (an unnonced tag would be
  // blocked). Same pattern as the per-page JSON-LD scripts.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang="en"
      className={`${chakraPetch.variable} ${newsreader.variable} ${jetbrainsMono.variable}`}
      style={{ background: '#000' }}
    >
      <body style={{ background: '#000' }}>
        {isProd && (
          <>
            <script defer src={PLAUSIBLE_SRC} nonce={nonce} />
            {/* New Plausible bootstrap + init — defines window.plausible (so the
                email/CTA events in AnalyticsTracker keep working) and starts
                auto pageview capture. Nonced to satisfy the strict-dynamic CSP. */}
            <script
              nonce={nonce}
              suppressHydrationWarning
              dangerouslySetInnerHTML={{
                __html:
                  'window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()',
              }}
            />
          </>
        )}
        <MotionProvider>
          <ChatProvider>
            {children}
            <PersistentChat />
          </ChatProvider>
        </MotionProvider>
        <AnalyticsTracker />
        <CookieConsentLoader />
      </body>
    </html>
  );
}
