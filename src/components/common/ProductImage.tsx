'use client';
import Image, { ImageProps } from 'next/image';
import { useEffect, useState } from 'react';

const FALLBACK =
  process.env.NEXT_PUBLIC_DEFAULT_PRODUCT_IMAGE_URL ??
  'https://your-zone.b-cdn.net/defaults/basket.png';

type Props = Omit<ImageProps, 'src'> & {
  src: string | null | undefined;
  /**
   * SKU-variant Cloudinary candidate (`imageUrlAlt` on the API, `{sku}_1`).
   * Some product photos were uploaded under a SKU-variant filename (e.g. a
   * re-shoot) — tried after `src` and before `fallbackSrc`.
   */
  altSrc?: string | null;
  /**
   * Barcode-derived Cloudinary candidate (`imageUrlFallback` on the API).
   * Some product photos were uploaded keyed by barcode instead of SKU —
   * tried after `altSrc` and before the default placeholder.
   */
  fallbackSrc?: string | null;
};

function buildCandidates(
  src: string | null | undefined,
  altSrc: string | null | undefined,
  fallbackSrc: string | null | undefined,
): string[] {
  const candidates = [src, altSrc, fallbackSrc, FALLBACK]
    .filter((c): c is string => Boolean(c && c.trim()));
  // De-dupe consecutive/repeat entries (e.g. fallbackSrc === FALLBACK when a
  // product has no barcode) without losing cascade order.
  return Array.from(new Set(candidates));
}

/**
 * Product image with a Cloudinary-aware fallback cascade:
 *   1. `src` — resolved server-side from the product SKU.
 *   2. `altSrc` — resolved server-side from `{sku}_1`, for photos uploaded
 *      under a SKU-variant filename.
 *   3. `fallbackSrc` — resolved server-side from the product barcode, for
 *      photos that were uploaded keyed by barcode instead of SKU.
 *   4. The default placeholder image.
 * We never verify existence server-side — each step only advances on the
 * browser's own `onError`, which is cheap and avoids HEAD-request storms.
 */
export function ProductImage({ src, altSrc, fallbackSrc, alt, ...rest }: Props) {
  const [candidates, setCandidates] = useState(() => buildCandidates(src, altSrc, fallbackSrc));
  const [index, setIndex] = useState(0);

  // If the upstream URLs change (e.g. variant switch), re-arm the cascade.
  useEffect(() => {
    setCandidates(buildCandidates(src, altSrc, fallbackSrc));
    setIndex(0);
  }, [src, altSrc, fallbackSrc]);

  const current = candidates[index] ?? FALLBACK;

  return (
    <Image
      {...rest}
      src={current}
      alt={alt}
      onError={() => {
        setIndex((i) => Math.min(i + 1, candidates.length - 1));
      }}
    />
  );
}
