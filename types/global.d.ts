// Browser globals injected by third-party scripts. Declared once here so
// AnalyticsTracker and CookieConsentLoader share a single definition instead
// of each re-declaring `Window.gtag`.
export {};

declare global {
  interface Window {
    // Google Analytics 4 — defined by CookieConsentLoader once analytics
    // consent is granted; undefined for decliners and before consent.
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    // Plausible's global, injected by the script tag in layout.tsx. Optional
    // because an ad-blocker may prevent the script from loading.
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number | boolean> },
    ) => void;
  }
}
