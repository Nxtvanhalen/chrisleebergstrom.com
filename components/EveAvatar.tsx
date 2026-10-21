import Image from 'next/image';

interface EveAvatarProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function EveAvatar({ width = 80, height = 45, className = '' }: EveAvatarProps) {
  return (
    <Image
      src="/images/EVEP.png"
      alt="EVE — the site's AI concierge"
      width={width}
      height={height}
      className={`object-cover object-top rounded-xl mask-fade-edges ${className}`}
      style={{ width, height }}
    />
  );
}
