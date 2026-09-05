import fileCleanupUtil from "./file-cleanup.util.js";

// {img, imgDesc} (the DB/ImageSchema shape) -> {url, alt, variants} (the display
// shape every mapper's public output uses). `variants` is the pure/derived
// {thumb, medium, original} srcset set (see getResponsiveImageUrls below) -
// safe to include unconditionally here (no fs check) because every image that
// went through multer.config.js's handleImageUpload got all three variants
// written together, atomically, on upload; there's no real-world case of an
// uploaded image missing a sibling. (The one exception - a manually-placed
// fallback file with no multer-generated siblings - is SiteSettings' hard-
// coded DEFAULT_HERO_IMAGE, which is why site-settings.service.js additionally
// runs getVerifiedResponsiveImageUrls below instead of trusting this blindly.)
export function formatImage(image) {
  if (!image) return null;
  return {
    url: image.img || null,
    alt: image.imgDesc || null,
    variants: getResponsiveImageUrls(image.img || null),
  };
}

// multer.config.js's handleImageUpload always writes the SAME base filename
// with three fixed suffixes: "-thumb.webp" (300w), "-medium.webp" (800w),
// "-original.webp" (1600w). Only one of those three URLs ends up stored per
// image (e.g. SiteSettings.hero.image only ever holds the "-medium" one) -
// this derives the sibling URLs by swapping the suffix, so callers can build
// a srcset without a schema change or re-upload. Returns null for any variant
// whose sibling file doesn't follow the convention (e.g. a manually-set path
// that isn't one of the three multer-generated variants) rather than
// guessing wrong.
const VARIANT_SUFFIXES = ["thumb", "medium", "original"];
const VARIANT_PATTERN = /-(thumb|medium|original)\.webp$/;

export function getImageVariantUrl(url, variant) {
  if (!url || !VARIANT_SUFFIXES.includes(variant)) return null;
  const match = url.match(VARIANT_PATTERN);
  if (!match) return null;
  return url.slice(0, match.index) + `-${variant}.webp`;
}

// {thumb, medium, original} URLs for a single stored image URL, for building
// a <img srcset>. Any variant that can't be derived (see getImageVariantUrl)
// comes back null - callers should fall back to the original single url.
export function getResponsiveImageUrls(url) {
  return {
    thumb: getImageVariantUrl(url, "thumb"),
    medium: getImageVariantUrl(url, "medium"),
    original: getImageVariantUrl(url, "original"),
  };
}

// Same as getResponsiveImageUrls, but additionally checks each derived
// variant actually exists on disk (via file-cleanup.util.js's imageFileExists)
// before handing it back, nulling out anything missing instead of leaving a
// srcset candidate that would 404. Slower (one fs.existsSync per variant) -
// only worth it for the one place that DOESN'T have multer's atomic-upload
// guarantee: SiteSettings' hard-coded DEFAULT_HERO_IMAGE fallback (see
// formatImage's comment above). Card mappers should keep using formatImage's
// built-in `variants` instead of calling this.
export function getVerifiedResponsiveImageUrls(url) {
  const variants = getResponsiveImageUrls(url);
  return {
    thumb: fileCleanupUtil.imageFileExists(variants.thumb) ? variants.thumb : null,
    medium: fileCleanupUtil.imageFileExists(variants.medium) ? variants.medium : null,
    original: fileCleanupUtil.imageFileExists(variants.original) ? variants.original : null,
  };
}

export default { formatImage, getImageVariantUrl, getResponsiveImageUrls, getVerifiedResponsiveImageUrls };
