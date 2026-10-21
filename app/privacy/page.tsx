import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { OG_IMAGES } from '@/app/og-image';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageHero from '@/components/PageHero';
import Reveal from '@/components/Reveal';
import { CONTACT_EMAIL, mailto } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy policy for chrisleebergstrom.com — how we collect, use, and protect your information. CLB Consulting is the legal entity that owns this site.',
  robots: 'index, follow',
  alternates: { canonical: 'https://chrisleebergstrom.com/privacy' },
  openGraph: {
    title: 'Privacy | Chris Lee Bergstrom',
    description:
      'Privacy policy for chrisleebergstrom.com — how we collect, use, and protect your information. CLB Consulting is the legal entity that owns this site.',
    type: 'website',
    url: 'https://chrisleebergstrom.com/privacy',
    images: OG_IMAGES,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy | Chris Lee Bergstrom',
    description:
      'Privacy policy for chrisleebergstrom.com — how we collect, use, and protect your information. CLB Consulting is the legal entity that owns this site.',
  },
};

// Bump this when the policy text changes. Hardcoded rather than `new Date()`:
// that rendered "today" on every visit and mismatched between server and client.
const LAST_UPDATED = '2026-10-20';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Deterministic (no timezone or locale involvement) so SSR and client agree.
function formatIsoDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-heading text-2xl md:text-3xl uppercase tracking-tight mb-4 mt-12 text-mauve">
      {children}
    </h2>
  );
}

function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-heading text-lg md:text-xl uppercase tracking-tight text-white mb-2 mt-6">
      {children}
    </h3>
  );
}

// In-prose links are underlined so they aren't distinguished by colour alone.
const LINK = 'text-mauve underline underline-offset-2 transition-colors hover:text-white';

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        className="relative bg-black text-white outline-none"
        aria-label="Privacy Policy"
      >
        <PageHero eyebrow="Legal" title="Privacy Policy" width="3xl" compact>
          <Reveal
            as="p"
            on="mount"
            duration={0.7}
            delay={0.2}
            className="font-mono text-[10px] tracking-[0.3em] uppercase mt-6 text-white/55"
          >
            Last updated · <time dateTime={LAST_UPDATED}>{formatIsoDate(LAST_UPDATED)}</time>
          </Reveal>
        </PageHero>

        {/* Body */}
        <section className="relative px-6 pb-16">
          <div className="mx-auto max-w-3xl font-body text-base md:text-lg leading-relaxed text-cream/82">
            <p>
              At CLB Consulting ("we," "our," or "us"), we respect your privacy and are committed to
              protecting your personal data. This privacy policy explains how we collect, use, and
              safeguard your information when you visit our website chrisleebergstrom.com.
            </p>
            <p className="mt-4">
              This policy covers chrisleebergstrom.com and the Beacons monitoring platform, operated
              by Christopher Lee Bergstrom (CLB Consulting). We will not share your mobile
              information with third parties for marketing purposes.
            </p>

            <H2>Information We Collect</H2>
            <H3>Information You Provide</H3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Contact information when you reach out via email</li>
              <li>
                Anything you type into our AI chat assistant (EVE) — see the EVE section below
              </li>
              <li>Professional information shared during consultations</li>
            </ul>

            <H3>Information Collected Automatically</H3>
            <p>
              Collected through the analytics and monitoring tools described in the next section:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Browser type and version, operating system, and device type</li>
              <li>Pages visited, time on page, and the referring website</li>
              <li>
                Approximate location (country/region), which the analytics providers derive from
                your IP address. Neither provider shows us the address itself.
              </li>
              <li>
                Your IP address, held briefly in our server's memory to rate-limit the EVE chat
                endpoint and protect against abuse. We do not log it.
              </li>
            </ul>

            <H2>Analytics and Error Monitoring</H2>
            <H3>Google Analytics 4</H3>
            <p>
              Runs only if you accept analytics cookies in the consent banner. It sets cookies (
              <code className="font-mono text-sm">_ga</code>,{' '}
              <code className="font-mono text-sm">_ga_*</code>) to recognise repeat visits and
              reports page views and events to Google under the Google Analytics terms. Withdrawing
              consent via "Cookie preferences" in the footer stops collection immediately and
              deletes those cookies.
            </p>
            <H3>Plausible Analytics</H3>
            <p>
              Runs for every visitor. Plausible is cookieless and collects no personal data: it
              records aggregate page views, referrers, country, and device type, cannot identify you
              or follow you across sites, and therefore does not require consent.
            </p>
            <H3>Sentry</H3>
            <p>
              When something on the site breaks, an error report (the error, its stack trace, and
              the page URL) is sent to Sentry so we can fix it. Sentry is configured not to receive
              request bodies, cookies, IP addresses, or anything you type into EVE.
            </p>

            <H2>Cookies and Browser Storage</H2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong className="text-white">Essential cookie</strong> — one cookie (
                <code className="font-mono text-sm">cc_cookie</code>) remembers your consent choice
                for six months so the banner doesn't reappear on every visit.
              </li>
              <li>
                <strong className="text-white">Analytics cookies</strong> — the Google Analytics
                cookies above, set only with your consent.
              </li>
              <li>
                <strong className="text-white">Browser storage (not cookies)</strong> — EVE keeps
                your chat history in your own browser's local storage so the conversation survives
                page changes. It stays on your device; clearing this site's data in your browser
                removes it.
              </li>
            </ul>
            <p className="mt-4">
              You choose your cookie preferences in the banner on your first visit and can change
              them at any time via "Cookie preferences" in the site footer.
            </p>

            <H2>How We Use Your Information</H2>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide and improve our services</li>
              <li>To respond to your inquiries and communications</li>
              <li>To analyze website usage and improve user experience</li>
              <li>To comply with legal obligations</li>
            </ul>

            <H2>Data Sharing and Third Parties</H2>
            <p>
              We do not sell, trade, or rent your personal information to third parties. We share
              data only with the service providers that run the site, each bound by its own privacy
              terms:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>
                <strong className="text-white">Render</strong> — hosts the website and its API
              </li>
              <li>
                <strong className="text-white">OpenAI</strong> — generates EVE's replies (see below)
              </li>
              <li>
                <strong className="text-white">Google</strong> — Google Analytics 4, with your
                consent
              </li>
              <li>
                <strong className="text-white">Plausible</strong> — cookieless site analytics
              </li>
              <li>
                <strong className="text-white">Sentry</strong> — error monitoring
              </li>
            </ul>
            <p className="mt-4">
              Beyond that, we disclose information only when required by law, to protect our rights,
              or with your explicit consent.
            </p>

            <H2>Data Security</H2>
            <p>
              We implement appropriate technical and organizational measures to protect your
              personal data against unauthorized access, alteration, disclosure, or destruction.
              However, no method of transmission over the internet is 100% secure.
            </p>

            <H2>Your Rights</H2>
            <p>Under GDPR and other privacy laws, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to processing of your data</li>
              <li>Data portability</li>
              <li>
                Withdraw consent at any time — for analytics, directly via "Cookie preferences" in
                the footer
              </li>
            </ul>

            <H2>AI Assistant (EVE)</H2>
            <p>
              EVE is powered by OpenAI. Each message you send goes through our server to OpenAI's
              API, which generates the reply. OpenAI keeps the thread for a limited period so
              follow-up questions have context, and processes it under its API data-usage terms (API
              conversations are not used to train its models by default). We do not store chat
              transcripts on our servers, and our error monitoring is configured to exclude them.
            </p>
            <p className="mt-4">
              Your side of the conversation is saved in your own browser's local storage so EVE can
              pick up where you left off; it never leaves your device except as part of the chat
              itself. Treat EVE like a public contact form: please don't share passwords, financial
              details, or other sensitive information with her.
            </p>

            <H2>Mobile / SMS Messaging</H2>
            <p>
              The Beacons monitoring platform, operated by Christopher Lee Bergstrom (CLB
              Consulting), sends automated account and system-health notification text messages
              (SMS) to the platform's named administrators during active monitoring sessions.
              Recipients opt in individually, in person; there is no public sign-up. Message
              frequency varies based on system events, and message and data rates may apply. You can
              reply STOP to unsubscribe at any time or HELP for help.
            </p>
            <p className="mt-4">
              <strong className="text-white">
                We will not share your mobile information with third parties for marketing purposes.
              </strong>{' '}
              Full SMS notification terms are available on our{' '}
              <Link href="/sms" className={LINK}>
                SMS Notifications
              </Link>{' '}
              page.
            </p>

            <H2>Children's Privacy</H2>
            <p>
              Our services are not directed to individuals under 16. We do not knowingly collect
              personal information from children under 16.
            </p>

            <H2>Changes to This Policy</H2>
            <p>
              We may update this privacy policy from time to time. We will notify you of any changes
              by posting the new policy on this page and updating the "Last updated" date.
            </p>

            <H2>Contact</H2>
            <p>
              If you have questions about this privacy policy or your personal data, please contact
              us:
            </p>
            <div className="mt-6 rounded-xs border border-mauve/30 bg-black/40 backdrop-blur-md p-6">
              <p className="font-heading uppercase tracking-tight text-white">CLB Consulting</p>
              <p className="mt-3">
                <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/55">
                  Email ·{' '}
                </span>
                <a href={mailto()} className={LINK}>
                  {CONTACT_EMAIL}
                </a>
              </p>
              <p className="mt-1">
                <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/55">
                  Site ·{' '}
                </span>
                <a href="https://chrisleebergstrom.com" className={LINK}>
                  chrisleebergstrom.com
                </a>
              </p>
            </div>

            <div className="mt-16 text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] uppercase text-mauve transition-colors hover:text-white"
              >
                ← Back to the work
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
