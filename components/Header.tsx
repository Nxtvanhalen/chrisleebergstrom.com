'use client';

import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type JSX, useCallback, useEffect, useRef, useState } from 'react';

// Internal nav links go through the App Router (prefetch, no full reload)
// while keeping motion's staggered enter animation.
const MotionLink = motion.create(Link);

// What the drawer's focus trap cycles through.
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Soft-edge mask shared by the animated logo and its reduced-motion poster.
const LOGO_MASK =
  'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)';

// Navigation links configuration
const NAV_LINKS = [
  { href: '/about', label: 'About Chris', description: 'Background and expertise' },
  { href: '/projects', label: 'Projects', description: 'Portfolio and gallery' },
  { href: '/news', label: 'News/Press', description: 'Latest coverage' },
  { href: '/blog', label: 'Musings', description: 'Strategic insights' },
  { href: '/faq', label: 'FAQ', description: 'Common questions' },
];

// Social links configuration
const SOCIAL_LINKS = [
  { href: 'https://www.instagram.com/chrisleebergstrom', label: 'Instagram', icon: 'instagram' },
  {
    href: 'https://www.facebook.com/share/15a8S2BF9S/?mibextid=wwXIfr',
    label: 'Facebook',
    icon: 'facebook',
  },
  { href: 'https://www.linkedin.com/in/chris-bergstrom', label: 'LinkedIn', icon: 'linkedin' },
  { href: 'https://www.youtube.com/@chrisleebergstrom', label: 'YouTube', icon: 'youtube' },
  { href: 'https://github.com/Nxtvanhalen', label: 'GitHub', icon: 'github' },
];

// Social icon SVGs
const SocialIcon = ({ type }: { type: string }) => {
  const icons: Record<string, JSX.Element> = {
    instagram: (
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    ),
    facebook: (
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    ),
    linkedin: (
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    ),
    youtube: (
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    ),
    github: (
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    ),
  };

  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {icons[type]}
    </svg>
  );
};

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
            className="logo z-10"
            aria-label="Chris Lee Bergstrom — Return to homepage"
            style={{ background: '#000' }}
          >
            <Image
              src="/images/Purple Logo.png"
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
              className={`h-12 w-auto opacity-70 motion-reduce:hidden ${isHomePage ? 'hidden' : ''}`}
              style={{
                background: '#000',
                mask: LOGO_MASK,
                maskComposite: 'intersect',
                WebkitMask: LOGO_MASK,
                WebkitMaskComposite: 'source-in',
              }}
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
              className={`h-12 w-auto opacity-70 motion-safe:hidden ${isHomePage ? 'hidden' : ''}`}
              style={{
                background: '#000',
                mask: LOGO_MASK,
                maskComposite: 'intersect',
                WebkitMask: LOGO_MASK,
                WebkitMaskComposite: 'source-in',
              }}
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
                  <div className="menu-social-icons">
                    {SOCIAL_LINKS.map((social) => (
                      <a
                        key={social.icon}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="menu-social-icon"
                        aria-label={`Follow on ${social.label}`}
                      >
                        <SocialIcon type={social.icon} />
                      </a>
                    ))}
                  </div>
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
