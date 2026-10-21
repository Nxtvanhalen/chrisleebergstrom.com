import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { OG_IMAGES } from '@/app/og-image';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import FaqClient from './FaqClient';
import { FAQ_ITEMS } from './faqs';

export const metadata: Metadata = {
  title: { absolute: 'FAQ | Chris Lee Bergstrom' },
  description:
    'Common questions about working with Chris Lee Bergstrom — agentic AI development, live-entertainment software, and the occasional consultation on venue operations, AI training, and web security.',
  alternates: { canonical: 'https://chrisleebergstrom.com/faq' },
  openGraph: {
    title: 'FAQ | Chris Lee Bergstrom',
    description:
      'Common questions about working with Chris Lee Bergstrom — AI development, live-entertainment software, and consulting.',
    type: 'website',
    url: 'https://chrisleebergstrom.com/faq',
    images: OG_IMAGES,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FAQ | Chris Lee Bergstrom',
    description:
      'Common questions about working with Chris Lee Bergstrom — AI development, live-entertainment software, and consulting.',
  },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  name: 'Frequently Asked Questions — Chris Lee Bergstrom',
  description:
    'Common questions about working with Chris Lee Bergstrom — AI development, live-entertainment software, and consulting.',
  url: 'https://chrisleebergstrom.com/faq',
  publisher: {
    '@type': 'Organization',
    '@id': 'https://chrisleebergstrom.com/#organization',
    name: 'CLB Consulting',
  },
  // Derived from the same list FaqClient renders — the visible page is the
  // source of truth for the structured data.
  mainEntity: FAQ_ITEMS.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
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
        name: 'FAQ',
        item: 'https://chrisleebergstrom.com/faq',
      },
    ],
  },
};

export default async function FaqPage() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <>
      <Header />
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <FaqClient />
      <Footer />
    </>
  );
}
