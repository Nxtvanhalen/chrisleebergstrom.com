'use client';

import { useEffect } from 'react';

// Pull the subject out of a mailto href, e.g.
// "mailto:a@b.com?subject=Project%20Inquiry" → "Project Inquiry".
function mailtoSubject(href: string): string | null {
  const raw = href.match(/[?&]subject=([^&]*)/)?.[1];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw;
  }
}

export default function AnalyticsTracker() {
  useEffect(() => {
    // One delegated listener instead of per-link handlers plus a body-wide
    // MutationObserver: links rendered later (client navigation, the menu
    // drawer, AnimatePresence) are covered for free.
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const link = target?.closest?.('a[href^="mailto:"]');
      if (!link) return;

      const href = link.getAttribute('href') || 'unknown';
      // Every CTA on the site is a mailto with a subject — that's the
      // conversion signal; a bare mailto is plain engagement.
      const subject = mailtoSubject(href);

      // GA only exists once analytics consent has been granted (see
      // CookieConsentLoader); after withdrawal its kill switch makes these no-ops.
      if (typeof window.gtag !== 'undefined') {
        window.gtag('event', 'email_click', {
          event_category: 'engagement',
          event_label: href,
          value: 1,
        });
        if (subject) {
          window.gtag('event', 'cta_click', {
            event_category: 'conversion',
            event_label: subject,
            value: 1,
          });
        }
      }

      // Mirror to Plausible (fires for consent-decliners too — cookieless).
      window.plausible?.('Email Click', { props: { href } });
      if (subject) window.plausible?.('CTA Click', { props: { subject } });
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
