import Link from 'next/link';
import CookiePreferencesButton from './CookiePreferencesButton';
import SocialLinks from './SocialLinks';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-logo">
          <img
            src="/images/purple-logo.png"
            alt="Chris Lee Bergstrom logo"
            className="h-8 w-auto"
          />
        </div>
        <SocialLinks
          className="flex justify-center gap-4 mt-4"
          linkClassName="text-white hover:text-mauve transition-colors"
        />
        <div className="footer-bottom">
          <p className="text-white!">
            &copy; {new Date().getFullYear()} CLB Consulting. All rights reserved. |{' '}
            <Link href="/privacy" className="text-white! hover:text-mauve transition-colors">
              Privacy Policy
            </Link>{' '}
            |{' '}
            <Link href="/sms" className="text-white! hover:text-mauve transition-colors">
              SMS Notifications
            </Link>{' '}
            |{' '}
            <CookiePreferencesButton className="font-body text-sm text-white! hover:text-mauve transition-colors cursor-pointer bg-transparent p-0" />
          </p>
        </div>
      </div>
    </footer>
  );
}
