// {img, imgDesc} (the DB/ImageSchema shape) -> {url, alt} (the display shape every
// mapper's public output uses). See this file's own comment history for why this
// isn't (yet) used everywhere - 8 mappers currently keep their own local copy.
export function formatImage(image) {
  if (!image) return null;
  return {
    url: image.img || null,
    alt: image.imgDesc || null,
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

export default { formatImage, getImageVariantUrl, getResponsiveImageUrls };
