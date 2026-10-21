import type { Metadata } from 'next';
import Link from 'next/link';
import { OG_IMAGES } from '@/app/og-image';
import Footer from '@/components/Footer';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'Beacons SMS Notifications',
  description:
    'How the Beacons monitoring platform, operated by Christopher Lee Bergstrom (CLB Consulting), uses SMS text notifications: who receives messages, how to opt in, message frequency, rates, and how to reply STOP or HELP.',
  robots: 'index, follow',
  alternates: { canonical: 'https://chrisleebergstrom.com/sms' },
  openGraph: {
    title: 'Beacons SMS Notifications | Chris Lee Bergstrom',
    description:
      'SMS notification terms for the Beacons monitoring platform — opt-in, message frequency, rates, STOP and HELP.',
    type: 'website',
    url: 'https://chrisleebergstrom.com/sms',
    images: OG_IMAGES,
  },
};

const TERM = 'font-heading text-lg md:text-xl uppercase tracking-tight text-white mb-1';
// In-prose links are underlined so they aren't distinguished by colour alone.
const LINK = 'text-mauve underline underline-offset-2 transition-colors hover:text-white';

export default function SmsPage() {
  return (
    <>
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        className="relative bg-black text-white outline-none"
        aria-label="Beacons SMS Notifications"
      >
        {/* Header */}
        <section className="relative px-6 pt-32 pb-8 md:pt-40 md:pb-12">
          <div className="mx-auto max-w-3xl">
            <p className="font-mono text-xs tracking-[0.35em] uppercase mb-4 text-mauve">Beacons</p>
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl uppercase tracking-tight text-white">
              SMS Notifications
            </h1>
          </div>
        </section>

        {/* Body */}
        <section className="relative px-6 pb-20">
          <div className="mx-auto max-w-3xl font-body text-base md:text-lg leading-relaxed text-cream/85">
            <p>
              Beacons, operated by Christopher Lee Bergstrom (CLB Consulting), sends automated
              account and system-health notification text messages to the platform&apos;s
              administrators during active monitoring sessions — for example, when a monitoring node
              goes offline or a critical condition is detected.
            </p>

            <dl className="mt-10 space-y-6">
              <div>
                <dt className={TERM}>Who receives messages</dt>
                <dd>
                  Only the platform&apos;s named administrators. There is no public sign-up;
                  recipients are added individually after opting in.
                </dd>
              </div>

              <div>
                <dt className={TERM}>How you opt in</dt>
                <dd>
                  Administrators opt in verbally, in person; a number is added only after the person
                  agrees.
                </dd>
              </div>

              <div>
                <dt className={TERM}>Message frequency</dt>
                <dd>Varies based on system events.</dd>
              </div>

              <div>
                <dt className={TERM}>Cost</dt>
                <dd>Message and data rates may apply.</dd>
              </div>

              <div>
                <dt className={TERM}>Opt out / help</dt>
                <dd>
                  Reply STOP to unsubscribe at any time, or HELP for help. You can also contact{' '}
                  <a href="mailto:chris@blackeyedproductionsusa.com" className={LINK}>
                    chris@blackeyedproductionsusa.com
                  </a>
                  .
                </dd>
              </div>

              <div>
                <dt className={TERM}>Privacy</dt>
                <dd>
                  We will not share your mobile information with third parties for marketing
                  purposes. See our{' '}
                  <Link href="/privacy" className={LINK}>
                    Privacy Policy
                  </Link>
                  .
                </dd>
              </div>
            </dl>

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
