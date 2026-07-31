import React from 'react';

/**
 * A supplied piece of artwork used as a UI glyph.
 *
 * The nav mixes two kinds of icon and they need different handling. Brand
 * marks (SuperStake, HEX, the wallet) carry their own colour and go in as
 * plain `<img>`. Interface glyphs — the eye, the magnifier — sit beside Tabler
 * line icons that inherit `currentColor`, so they have to recolour with the
 * theme and with hover/active state or they read as foreign objects.
 *
 * `mask` renders the artwork's silhouette in the current text colour, which is
 * what makes it behave like its neighbours. It also sidesteps a real problem:
 * artwork drawn dark-on-white is invisible against a dark nav, and stripping
 * the white to transparent only makes it invisible in a different way. Masking
 * throws the source colour away entirely and keeps the shape.
 */
export function ArtIcon({
  src,
  alt,
  className = 'h-5 w-5',
  mask = false,
}: {
  src: string;
  alt: string;
  className?: string;
  /** Recolour to `currentColor` instead of drawing the artwork's own colours. */
  mask?: boolean;
}) {
  if (mask) {
    return (
      <span
        role="img"
        aria-label={alt}
        className={`${className} shrink-0 inline-block bg-current`}
        style={{
          maskImage: `url(${src})`,
          WebkitMaskImage: `url(${src})`,
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskPosition: 'center',
        }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`${className} shrink-0 object-contain`} />
  );
}

export default ArtIcon;
