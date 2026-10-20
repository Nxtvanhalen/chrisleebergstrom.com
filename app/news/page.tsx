import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import { OG_IMAGES } from '../og-image';
import NewsClient from './NewsClient';

export const metadata: Metadata = {
  title: { absolute: 'News & Press | Chris Lee Bergstrom' },
  description:
    'Press coverage, podcast appearances, and music/video credits featuring Chris Lee Bergstrom — AI developer and 20-year live entertainment veteran.',
  alternates: { canonical: 'https://chrisleebergstrom.com/news' },
  openGraph: {
    title: 'News | Chris Lee Bergstrom',
    description: 'Press coverage, podcast appearances, and credits featuring Chris Lee Bergstrom.',
    type: 'website',
    url: 'https://chrisleebergstrom.com/news',
    images: OG_IMAGES,
  },
  twitter: {
    card: 'summary_large_image',
    site: '@chrisleebergstrom',
    creator: '@chrisleebergstrom',
    title: 'News | Chris Lee Bergstrom',
    description: 'Press coverage, podcast appearances, and credits featuring Chris Lee Bergstrom.',
  },
};

const newsSchema = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'News & Press — Chris Lee Bergstrom',
  description: 'Latest news, press coverage, and media appearances featuring Chris Lee Bergstrom',
  url: 'https://chrisleebergstrom.com/news',
  author: {
    '@type': 'Person',
    '@id': 'https://chrisleebergstrom.com/about#person',
    name: 'Chris Lee Bergstrom',
  },
  about: {
    '@type': 'Organization',
    '@id': 'https://chrisleebergstrom.com/#organization',
    name: 'CLB Consulting',
  },
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://chrisleebergstrom.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'News/Press',
        item: 'https://chrisleebergstrom.com/news',
      },
    ],
  },
};

export default async function NewsPage() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <>
      <Header />
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newsSchema) }}
      />
      <NewsClient />
      <Footer />
    </>
  );
}
