import type { MetadataRoute } from 'next';

// Fixed per-route dates rather than `new Date()` on every request — a sitemap
// that claims everything changed today just teaches crawlers to ignore lastmod.
// Bump a date when that route's content actually changes
// (`git log -1 --format=%cs -- app/<route>` finds the last real edit).
const LAST_MODIFIED: Record<string, string> = {
  '/': '2026-10-05',
  '/about': '2026-09-28',
  '/projects': '2026-09-28',
  '/blog': '2026-09-28',
  '/news': '2026-09-28',
  '/faq': '2026-09-28',
  '/privacy': '2026-10-20',
  '/sms': '2026-07-10',
};

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://chrisleebergstrom.com';
  const lastModified = (route: string) => new Date(LAST_MODIFIED[route]);

  return [
    {
      url: `${baseUrl}/`,
      lastModified: lastModified('/'),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: lastModified('/about'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/projects`,
      lastModified: lastModified('/projects'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: lastModified('/blog'),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/news`,
      lastModified: lastModified('/news'),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: lastModified('/faq'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: lastModified('/privacy'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/sms`,
      lastModified: lastModified('/sms'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
