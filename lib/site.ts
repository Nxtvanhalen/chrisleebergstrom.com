// Contact details shared by every CTA. The JSON-LD blocks in app/*/page.tsx
// repeat the address on purpose: structured data is kept literal and greppable.

export const CONTACT_EMAIL = 'chrisleebergstrom@gmail.com';

export const SUBSTACK_URL = 'https://chrisleebergstrom.substack.com';

/** `mailto:` link to Chris, with an optional pre-filled subject. */
export function mailto(subject?: string): string {
  return subject
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${CONTACT_EMAIL}`;
}
