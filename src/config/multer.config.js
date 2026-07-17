import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

ffmpeg.setFfmpegPath(ffmpegStatic);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_PATH = process.env.UPLOAD_PUBLIC_PATH || path.join(__dirname, "..", "public");

await fs.ensureDir(path.join(PUBLIC_PATH, "images", "services"));
await fs.ensureDir(path.join(PUBLIC_PATH, "images", "packages"));
await fs.ensureDir(path.join(PUBLIC_PATH, "images", "categories"));
await fs.ensureDir(path.join(PUBLIC_PATH, "images", "posts"));
await fs.ensureDir(path.join(PUBLIC_PATH, "images", "testimonials"));
await fs.ensureDir(path.join(PUBLIC_PATH, "images", "experts"));
await fs.ensureDir(path.join(PUBLIC_PATH, "images", "site"));
await fs.ensureDir(path.join(PUBLIC_PATH, "videos"));
await fs.ensureDir(path.join(PUBLIC_PATH, "videos", "thumbnails"));

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
// shared across images and videos - images get resized down by sharp regardless
// of upload size, so raising this mainly exists to give video uploads real room
// (10MB was only ever going to fit a few seconds of video)
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

// Physical save folder is keyed by `type` (services/packages/posts/...), not by
// field name - field names like "gallery" are deliberately reused across
// several entities (services, packages, posts all upload to a field literally
// named "gallery"), so keying off fieldname collapsed all of them into the same
// folder regardless of which entity actually owns the upload. `type` is already
// passed explicitly at every call site (see the routes files) and is what the
// returned URL (/images/${type}/...) is built from too - so this makes the
// folder actually written to match the URL that gets saved to the database.
const KNOWN_IMAGE_TYPES = new Set(["services", "packages", "categories", "posts", "testimonials", "experts", "site"]);

function getDestination(type) {
  const subfolder = KNOWN_IMAGE_TYPES.has(type) ? type : "site";
  return path.join(PUBLIC_PATH, "images", subfolder);
}

function generateFilename(originalname) {
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const ext = path.extname(originalname).toLowerCase();
  const base =
    path
      .basename(originalname, ext)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "") || "file";
  return `${base}-${uniqueSuffix}`;
}

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "video") {
    if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) return cb(null, true);
    return cb(new Error(`Nepodržan format videa: ${file.mimetype}`));
  }
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
  return cb(new Error(`Nepodržan format slike: ${file.mimetype}`));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });

// =============== IMAGE (sharp) ===============

async function handleImageUpload(file, destination, type) {
  const baseFilename = generateFilename(file.originalname);

  const variants = {
    thumb: { width: 300, suffix: "thumb" },
    medium: { width: 800, suffix: "medium" },
    original: { width: 1600, suffix: "original" },
  };

  const savedFiles = {};

  for (const [key, config] of Object.entries(variants)) {
    const filename = `${baseFilename}-${config.suffix}.webp`;
    const outputPath = path.join(destination, filename);

    await sharp(file.buffer)
      .resize({ width: config.width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outputPath);

    savedFiles[key] = `/images/${type}/${filename}`;
  }

  return {
    img: savedFiles.medium || savedFiles.original || savedFiles.thumb,
    imgThumb: savedFiles.thumb || null,
    imgMedium: savedFiles.medium || null,
    imgOriginal: savedFiles.original || null,
    imgDesc: "",
  };
}

// =============== VIDEO (ffmpeg - thumbnail only, no re-encode) ===============

async function processVideo(buffer, baseFilename) {
  const videoDir = path.join(PUBLIC_PATH, "videos");
  const thumbDir = path.join(PUBLIC_PATH, "videos", "thumbnails");

  const videoFilename = `${baseFilename}.mp4`;
  const videoPath = path.join(videoDir, videoFilename);
  await fs.writeFile(videoPath, buffer);

  const thumbFilename = `${baseFilename}-thumb.webp`;

  await new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({ count: 1, folder: thumbDir, filename: thumbFilename, size: "320x180", quality: 80 })
      .on("end", resolve)
      .on("error", reject);
  });

  return {
    url: `/videos/${videoFilename}`,
    thumbnail: `/videos/thumbnails/${thumbFilename}`,
    title: "",
  };
}

// =============== SINGLE UPLOAD ===============

function processUpload(fieldName, type = "site") {
  return [
    upload.single(fieldName),
    async (req, res, next) => {
      try {
        if (!req.file) return next();

        const destination = getDestination(type);
        const isVideo = ALLOWED_VIDEO_TYPES.includes(req.file.mimetype);

        if (isVideo) {
          const baseFilename = generateFilename(req.file.originalname);
          req.uploadedFile = await processVideo(req.file.buffer, baseFilename);
        } else {
          req.uploadedFile = await handleImageUpload(req.file, destination, type);
        }

        next();
      } catch (error) {
        next(error);
      }
    },
  ];
}

// =============== MULTIPLE UPLOADS (e.g. gallery[]) ===============

function processMultipleUploads(fieldsConfig = []) {
  const multerFields = fieldsConfig.map((f) => ({ name: f.name, maxCount: f.maxCount || 1 }));

  return [
    upload.fields(multerFields),
    async (req, res, next) => {
      try {
        if (!req.files || Object.keys(req.files).length === 0) return next();

        req.uploadedFiles = {};

        for (const config of fieldsConfig) {
          const files = req.files[config.name];
          if (!files || files.length === 0) continue;

          const type = config.type || "site";
          const destination = getDestination(type);
          const results = [];

          for (const file of files) {
            const isVideo = ALLOWED_VIDEO_TYPES.includes(file.mimetype);
            if (isVideo) {
              results.push(await processVideo(file.buffer, generateFilename(file.originalname)));
            } else {
              results.push(await handleImageUpload(file, destination, type));
            }
          }

          req.uploadedFiles[config.name] = files.length === 1 ? results[0] : results;
        }

        next();
      } catch (error) {
        next(error);
      }
    },
  ];
}

export default upload;
export { processUpload, processMultipleUploads, getDestination };