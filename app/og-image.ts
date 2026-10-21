// Site-wide share image, used by the root layout and every page that sets
// its own `openGraph` block. Next shallow-merges metadata, so a page that
// defines `openGraph` without `images` loses the layout's image entirely —
// link previews (iMessage etc.) then scrape the transparent header logo,
// which renders on a checkerboard. One constant beats eight copies.
export const OG_IMAGES = [
  {
    url: '/images/profile/chris-profile-square-2.jpg',
    width: 1095,
    height: 1095,
    alt: 'Chris Lee Bergstrom — AI developer and live entertainment veteran',
  },
];
