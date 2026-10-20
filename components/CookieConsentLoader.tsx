'use client';

import { useEffect } from 'react';

const GA_TRACKING_ID = 'G-XZ6CF9XQD7';
// Google's documented kill switch: while this global is true, gtag.js stops
// collecting for the property — no hits, no cookie refresh.
const GA_DISABLE_KEY = `ga-disable-${GA_TRACKING_ID}`;

type CookieConsentApi = typeof import('vanilla-cookieconsent');

function setGaDisabled(disabled: boolean) {
  (window as unknown as Record<string, unknown>)[GA_DISABLE_KEY] = disabled;
}

function loadGoogleAnalytics() {
  setGaDisabled(false);
  if (window.gtag) {
    // Script already loaded this session (consent withdrawn, then re-granted).
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    return;
  }
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`;
  s.onload = () => {
    window.dataLayer = window.dataLayer || [];
    function gtag(...args: any[]) {
      window.dataLayer!.push(args);
    }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_TRACKING_ID);
  };
  document.head.appendChild(s);
}

// Consent withdrawn: stop collection and remove the cookies GA already set
// (_ga, _ga_<container>, _gid). The script stays loaded — the kill switch makes
// every later gtag() call a no-op for this property.
function disableGoogleAnalytics(CookieConsent: CookieConsentApi) {
  setGaDisabled(true);
  window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
  CookieConsent.eraseCookies([/^_ga/, '_gid']);
}

export default function CookieConsentLoader() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const CookieConsent = await import('vanilla-cookieconsent');
      await import('vanilla-cookieconsent/dist/cookieconsent.css');
      if (cancelled) return;

      await CookieConsent.run({
        guiOptions: {
          consentModal: {
            layout: 'bar',
            position: 'bottom center',
            equalWeightButtons: false,
            flipButtons: false,
          },
        },
        categories: {
          necessary: { enabled: true, readOnly: true },
          analytics: { enabled: false },
        },
        language: {
          default: 'en',
          translations: {
            en: {
              consentModal: {
                title: 'Cookies',
                description:
                  'We use cookies to enhance your experience and analyze site usage. Read our <a href="/privacy">cookie policy</a>.',
                acceptAllBtn: 'Accept Cookies',
                acceptNecessaryBtn: 'Decline Cookies',
              },
              preferencesModal: {
                title: 'Cookie preferences',
                acceptAllBtn: 'Accept all',
                acceptNecessaryBtn: 'Decline all',
                savePreferencesBtn: 'Save preferences',
                closeIconLabel: 'Close',
                sections: [
                  {
                    title: 'Strictly necessary',
                    description:
                      'These cookies are essential for the website to function and cannot be disabled.',
                    linkedCategory: 'necessary',
                  },
                  {
                    title: 'Analytics',
                    description:
                      'Help us understand how visitors use the site so we can improve it (Google Analytics). Withdrawing consent stops collection and removes its cookies. You can reopen this dialog any time from "Cookie preferences" in the footer.',
                    linkedCategory: 'analytics',
                  },
                ],
              },
            },
          },
        },
        onConsent: () => {
          if (CookieConsent.acceptedCategory('analytics')) {
            loadGoogleAnalytics();
          }
        },
        onChange: ({ changedCategories }) => {
          if (!changedCategories.includes('analytics')) return;
          if (CookieConsent.acceptedCategory('analytics')) {
            loadGoogleAnalytics();
          } else {
            disableGoogleAnalytics(CookieConsent);
          }
        },
      });
    })().catch((err: unknown) => {
      console.error('Cookie consent failed to initialise:', err);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
