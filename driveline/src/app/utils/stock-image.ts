/**
 * Responsive WebP versions of stock photos (made by scripts/optimize-stock-images.mjs):
 * X.jpg → X-480.webp, X-800.webp and, for a car's main photo, X-1600.webp.
 * Templates use these in a <picture><source type="image/webp" …> with the JPG as fallback.
 */
export function webpSrcset(path: string | null | undefined, hiRes = false): string | null {
  if (!path || !/^\/?stock\/.+\.(jpe?g|png)$/i.test(path)) return null;
  const base = path.replace(/\.(jpe?g|png)$/i, '');
  return [`${base}-480.webp 480w`, `${base}-800.webp 800w`, ...(hiRes ? [`${base}-1600.webp 1600w`] : [])].join(', ');
}

/** Best single WebP for a fixed-size use (e.g. thumbnails). */
export function webpAt(path: string | null | undefined, width: 480 | 800 | 1600): string | null {
  if (!path || !/^\/?stock\/.+\.(jpe?g|png)$/i.test(path)) return null;
  return `${path.replace(/\.(jpe?g|png)$/i, '')}-${width}.webp`;
}

/** `sizes` hints for the common layouts. */
export const IMG_SIZES = {
  card: '(min-width: 3000px) 580px, (min-width: 2200px) 500px, (min-width: 1280px) 400px, (min-width: 1024px) 31vw, (min-width: 640px) 48vw, 100vw',
  galleryMain: '(min-width: 3000px) 1150px, (min-width: 2200px) 1000px, (min-width: 1280px) 820px, (min-width: 768px) 64vw, 100vw',
  galleryTile: '(min-width: 2200px) 380px, (min-width: 1280px) 300px, (min-width: 768px) 22vw, 50vw',
  full: '100vw',
  thumb: '160px',
};
