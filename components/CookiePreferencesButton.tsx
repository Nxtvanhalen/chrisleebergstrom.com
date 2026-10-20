'use client';

// Footer "Cookie preferences" control — reopens the vanilla-cookieconsent
// preferences modal so analytics consent can be reviewed or withdrawn after
// the first-visit banner is gone (withdrawal has to be as easy as consent).
export default function CookiePreferencesButton({ className }: { className?: string }) {
  const openPreferences = () => {
    // Same module instance CookieConsentLoader initialised — the bundler
    // dedupes the dynamic import, and run() has long finished by the time
    // anyone scrolls to the footer.
    import('vanilla-cookieconsent')
      .then((CookieConsent) => CookieConsent.showPreferences())
      .catch((err: unknown) => {
        console.error('Could not open cookie preferences:', err);
      });
  };

  return (
    <button type="button" onClick={openPreferences} className={className}>
      Cookie preferences
    </button>
  );
}
