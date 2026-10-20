import type { Metadata } from 'next';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import { OG_IMAGES } from '../og-image';
import PrivacyClient from './PrivacyClient';

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
    site: '@chrisleebergstrom',
    creator: '@chrisleebergstrom',
    title: 'Privacy | Chris Lee Bergstrom',
    description:
      'Privacy policy for chrisleebergstrom.com — how we collect, use, and protect your information. CLB Consulting is the legal entity that owns this site.',
  },
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <PrivacyClient />
      <Footer />
    </>
  );
}
