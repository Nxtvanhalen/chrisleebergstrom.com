'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

// EVE's face, used at several sizes. At VIDEO_MIN_WIDTH and up (the chat
// toggle, the panel header, the nudge) it is a small muted loop; below that
// (the 28px face on every message bubble) and under prefers-reduced-motion it
// is the still, so a long transcript never decodes a dozen videos.
const VIDEO_MIN_WIDTH = 60;
const STILL = '/images/eve-poster.jpg';
const LOOP = '/videos/eve-avatar-loop.mp4';
const ALT = "EVE — the site's AI concierge";

interface EveAvatarProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function EveAvatar({ width = 80, height = 45, className = '' }: EveAvatarProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const animated = width >= VIDEO_MIN_WIDTH;

  // Autoplay unless the visitor prefers reduced motion (the CSS then hides
  // the clip and shows the still); follow the setting if it changes. Calling
  // play() here also covers React not serialising `muted` into SSR markup.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      if (reduceMotion.matches) video.pause();
      else void video.play().catch(() => {});
    };
    apply();
    reduceMotion.addEventListener('change', apply);
    return () => reduceMotion.removeEventListener('change', apply);
  }, []);

  const frame = `object-cover object-top rounded-xl mask-fade-edges ${className}`;
  const size = { width, height };

  if (!animated) {
    return (
      <Image src={STILL} alt={ALT} width={width} height={height} className={frame} style={size} />
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster={STILL}
        width={width}
        height={height}
        aria-hidden="true"
        tabIndex={-1}
        className={`${frame} motion-reduce:hidden`}
        style={size}
      >
        <source src={LOOP} type="video/mp4" />
      </video>
      <Image
        src={STILL}
        alt={ALT}
        width={width}
        height={height}
        className={`hidden motion-reduce:block ${frame}`}
        style={size}
      />
    </>
  );
}
