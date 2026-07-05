import path from "path";
import fs from "fs-extra";

export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

const PUBLIC_IMAGES_PATH = path.join(process.cwd(), "src", "public", "images");

export async function cleanupUploadedImage(imgUrl) {
  if (!imgUrl) return;
  const match = imgUrl.match(/^\/images\/([^/]+)\/(.+)-(?:thumb|medium|original)\.webp$/);
  if (!match) return;
  const [, type, baseFilename] = match;
  const dir = path.join(PUBLIC_IMAGES_PATH, type);
  await Promise.all(
    ["thumb", "medium", "original"].map((suffix) =>
      fs.remove(path.join(dir, `${baseFilename}-${suffix}.webp`)).catch(() => {})
    )
  );
}

export default { TINY_PNG, cleanupUploadedImage };