'use client';

import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import SocialLinks from './SocialLinks';

// Internal nav links go through the App Router (prefetch, no full reload)
// while keeping motion's staggered enter animation.
const MotionLink = motion.create(Link);

// What the drawer's focus trap cycles through.
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Soft-edge mask shared by the animated logo and its reduced-motion poster.
const LOGO_MASK = 'mask-fade-edges [--mask-fade:12%]';

// Navigation links configuration
const NAV_LINKS = [
  { href: '/about', label: 'About Chris', description: 'Background and expertise' },
  { href: '/projects', label: 'Projects', description: 'Portfolio and gallery' },
  { href: '/news', label: 'News/Press', description: 'Latest coverage' },
  { href: '/blog', label: 'Musings', description: 'Strategic insights' },
  { href: '/faq', label: 'FAQ', description: 'Common questions' },
];

export default function Header() {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const isAboutPage = pathname === '/about';
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const skipLinkRef = useRef<HTMLAnchorElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const logoVideoRef = useRef<HTMLVideoElement>(null);
  const profileVideoRef = useRef<HTMLVideoElement>(null);
  // Set when the drawer closes via Escape / close button / backdrop so focus
  // goes back to the hamburger once the page is no longer inert.
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Skip-link defocus on route change.
  // Next App Router's post-navigation focus heuristic occasionally parks focus
  // on the skip link (it's the first focusable element in the tree). Some browsers
  // then treat that as keyboard-modality, :focus-visible matches, and the link
  // stays visible until the user clicks. Explicitly blurring it on pathname
  // change defeats the regression without removing keyboard tabbability — a Tab
  // press from a fresh page still reveals + activates it normally.
  useEffect(() => {
    void pathname; // Effect intentionally re-runs on every pathname change.
    if (skipLinkRef.current && document.activeElement === skipLinkRef.current) {
      skipLinkRef.current.blur();
    }
  }, [pathname]);

  // Reduced motion (WCAG 2.2.2): the Tailwind motion-reduce/motion-safe variants
  // swap each autoplay loop for its poster frame instantly, with no hydration
  // flash. This effect additionally pauses the now-invisible videos so they
  // don't burn CPU, and resumes them if the OS preference flips back. Re-runs
  // on pathname because the profile video re-mounts between pages.
  useEffect(() => {
    void pathname;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      for (const video of [logoVideoRef.current, profileVideoRef.current]) {
        if (!video) continue;
        if (mq.matches) video.pause();
        else video.play().catch(() => {});
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pathname]);

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  // Links call this without options: navigation takes focus somewhere new.
  // Escape / close / backdrop pass restoreFocus so focus returns to the button.
  const closeMenu = useCallback((opts?: { restoreFocus?: boolean }) => {
    if (opts?.restoreFocus) restoreFocusRef.current = true;
    setMenuOpen(false);
  }, []);

  // Close menu on escape key
  useEffect(() => {
    if (!menuOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu({ restoreFocus: true });
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [menuOpen, closeMenu]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  // While the drawer is open the rest of the page is inert: not focusable, not
  // clickable, hidden from assistive tech. The drawer and its backdrop are
  // direct children of <body> (no portal), so every other body child — skip
  // link, header, main, footer, the chat widget — gets the attribute. Cleanup
  // runs before the focus-restore effect below, so the button is focusable again
  // by the time we focus it.
  useEffect(() => {
    if (!menuOpen) return;
    const keep = [panelRef.current, backdropRef.current];
    const made: Element[] = [];
    for (const el of Array.from(document.body.children)) {
      if (el.tagName === 'SCRIPT' || el.hasAttribute('inert')) continue;
      if (keep.some((k) => k && (k === el || el.contains(k)))) continue;
      el.setAttribute('inert', '');
      made.push(el);
    }
    return () => {
      for (const el of made) el.removeAttribute('inert');
    };
  }, [menuOpen]);

  // Move focus into the drawer on open and keep Tab cycling inside it.
  useEffect(() => {
    if (!menuOpen) return;
    const panel = panelRef.current;
    if (!panel) return;
    panel.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });

    const trapTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapTab);
    return () => document.removeEventListener('keydown', trapTab);
  }, [menuOpen]);

  // Return focus to the hamburger after a close that wasn't a navigation.
  useEffect(() => {
    if (menuOpen || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    menuButtonRef.current?.focus();
  }, [menuOpen]);

  return (
    <>
      {/* Skip-to-content link — :focus-visible reveal for keyboard users.
          A useEffect above explicitly blurs this on pathname change so Next's
          post-navigation focus heuristic can't pin :focus-visible on it. */}
      <a
        ref={skipLinkRef}
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-200 focus-visible:px-4 focus-visible:py-2 focus-visible:bg-black focus-visible:text-white focus-visible:rounded-xs focus-visible:outline-hidden focus-visible:border focus-visible:border-mauve focus-visible:font-mono focus-visible:text-xs focus-visible:uppercase focus-visible:tracking-[0.2em]"
      >
        Skip to main content
      </a>

      <header className={`header ${scrolled ? 'scrolled' : ''}`}>
        <div className="flex items-center justify-between w-full">
          {/* Logo — Image, video and poster all stay mounted; visibility toggled by CSS.
              Prevents the white-frame flash that occurred when client-side navigation
              re-mounted a fresh video element between pages. */}
          <Link
            href="/"
            className="logo z-10 bg-black"
            aria-label="Chris Lee Bergstrom — Return to homepage"
          >
            <Image
              src="/images/purple-logo.png"
              alt="Chris Lee Bergstrom logo"
              width={1281}
              height={539}
              sizes="76px"
              className={`h-8 w-auto ${isHomePage ? '' : 'hidden'}`}
              priority
            />
            {/* Animated logo is decorative — the link already has an accessible
                name — so it's hidden from AT. Under prefers-reduced-motion the
                motion-reduce variant hides it and the poster below shows instead. */}
            <video
              ref={logoVideoRef}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              width={180}
              height={48}
              poster="/images/logo-poster.jpg"
              aria-hidden="true"
              tabIndex={-1}
              className={`h-12 w-auto opacity-70 bg-black ${LOGO_MASK} motion-reduce:hidden ${isHomePage ? 'hidden' : ''}`}
            >
              <source src="/videos/animated-logo-trimmed.mp4" type="video/mp4" />
            </video>
            <Image
              src="/images/logo-poster.jpg"
              alt=""
              aria-hidden="true"
              width={1280}
              height={720}
              sizes="85px"
              className={`h-12 w-auto opacity-70 bg-black ${LOGO_MASK} motion-safe:hidden ${isHomePage ? 'hidden' : ''}`}
            />
          </Link>

          {/* Profile Picture - Center (all breakpoints; smaller on mobile) */}
          <div className="block absolute left-1/2 transform -translate-x-1/2">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border border-molten/50 overflow-hidden bg-linear-to-br from-molten/30 to-gray-700/50 relative">
              {/* Decorative loop. The About page shows the still instead, and so
                  does anyone with prefers-reduced-motion (motion-* variants). */}
              {!isAboutPage && (
                <video
                  ref={profileVideoRef}
                  autoPlay
                  loop
                  muted
                  playsInline
                  aria-hidden="true"
                  tabIndex={-1}
                  className="w-full h-full object-cover object-top motion-reduce:hidden"
                >
                  <source src="/videos/cbai-profile-v2.mp4" type="video/mp4" />
                </video>
              )}
              <Image
                src="/images/profile/CBAI.webp"
                alt="Chris Lee Bergstrom"
                width={64}
                height={64}
                sizes="64px"
                className={`w-full h-full object-cover object-top ${isAboutPage ? '' : 'motion-safe:hidden'}`}
                priority={isAboutPage}
              />
            </div>
          </div>

          {/* Hamburger Button — opens the drawer with the deep-page nav + social icons */}
          <button
            ref={menuButtonRef}
            onClick={toggleMenu}
            className="hamburger-btn z-10"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <div className="hamburger-icon">
              <motion.span
                className="hamburger-line"
                animate={menuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.span
                className="hamburger-line"
                animate={menuOpen ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.span
                className="hamburger-line"
                animate={menuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </button>
        </div>
      </header>

      {/* Full-screen Menu Overlay */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              ref={backdropRef}
              className="menu-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => closeMenu({ restoreFocus: true })}
              aria-hidden="true"
            />

            {/* Menu Panel — a modal dialog wrapping the nav, so AT announces it
                as such and the inert/focus-trap effects above make it behave. */}
            <motion.div
              ref={panelRef}
              id="mobile-menu"
              className="menu-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              {/* Close Button */}
              <button
                onClick={() => closeMenu({ restoreFocus: true })}
                className="menu-close-btn"
                aria-label="Close menu"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              <nav className="menu-content" aria-label="Main navigation">
                {/* Navigation Links */}
                <div className="menu-links">
                  {NAV_LINKS.map((link, index) => (
                    <MotionLink
                      key={link.href}
                      href={link.href}
                      className="menu-link"
                      aria-current={pathname === link.href ? 'page' : undefined}
                      onClick={() => closeMenu()}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <span className="menu-link-label">{link.label}</span>
                      <span className="menu-link-desc">{link.description}</span>
                    </MotionLink>
                  ))}
                </div>

                {/* Divider */}
                <div className="menu-divider" />

                {/* Social Links */}
                <motion.div
                  className="menu-social"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <span className="menu-social-label">Connect</span>
                  <SocialLinks className="menu-social-icons" linkClassName="menu-social-icon" />
                </motion.div>

                {/* Designer Credit */}
                <motion.a
                  href="https://lizpettengill.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="menu-credit"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  Logo by Liz Pettengill
                </motion.a>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
