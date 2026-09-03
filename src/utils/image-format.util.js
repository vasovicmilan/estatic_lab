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

export default { formatImage };
