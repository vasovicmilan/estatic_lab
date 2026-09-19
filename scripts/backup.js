// Daily local backup: a full mongodump of the database plus a tarball of the
// actual user-uploaded images/videos (everything under UPLOAD_PUBLIC_PATH's
// images/ and videos/ folders - NOT the whole public/ folder, since the rest
// of that folder is build output (custom Bootstrap CSS, the icon-subset font)
// that DEPLOYMENT.md already says is regenerated per server via `npm run
// build:css`/`build:icons`, not something a backup needs to carry).
//
// Phase 1 (this script): local only, same server, once a day via system
// cron - see docs/*/17-backups.md for the crontab line and the mongodump/
// mongorestore install step this needs (MongoDB Database Tools - a separate
// OS package, NOT an npm dependency, since mongodump talks the wire protocol
// directly and has nothing to do with the app's own Mongoose connection).
// Phase 2 (not yet built): syncing these local dated folders offsite (USB /
// Google Drive) - deliberately left for later, once local backups alone have
// been confirmed working for a few days.
//
// Deliberately a standalone script (like scripts/daily-log-report.js and
// friends), not a job registered in jobs/scheduler.js: a backup's schedule
// should not depend on the app process being up and healthy in the first
// place - if the app has crashed, that's exactly when you still want last
// night's backup to have happened. System cron owns this, not node-cron.
import "dotenv/config";
import path from "path";
import fs from "fs-extra";
import { execFile } from "child_process";
import { promisify } from "util";
import { logInfo, logError } from "../src/utils/logger.util.js";
import { alertError } from "../src/utils/telegram-alert.util.js";
import { toDateKey } from "../src/utils/date.time.util.js";

const execFileAsync = promisify(execFile);

const BACKUP_DIR = process.env.BACKUP_DIR;
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS) || 14;
const UPLOAD_PUBLIC_PATH = process.env.UPLOAD_PUBLIC_PATH || path.join(process.cwd(), "src", "public");
const MONGO_URI = process.env.MONGO_URI;

// Only the genuinely irreplaceable content-upload subfolders (see
// multer.config.js for the full authoritative list of these same folder
// names) - a fresh `npm install` + build steps recreate everything else
// under public/.
const UPLOAD_SUBFOLDERS = ["images", "videos"];

async function runMongodump(destArchive) {
  if (!MONGO_URI) throw new Error("MONGO_URI is not set");
  // A single gzip-compressed archive file (not the default directory-of-BSON-
  // files layout) - one file is simpler to move, verify the size of, and
  // restore from later (`mongorestore --uri=... --archive=<file> --gzip`).
  await execFileAsync("mongodump", ["--uri", MONGO_URI, "--archive=" + destArchive, "--gzip"]);
}

async function backupUploads(destArchive) {
  const existingSubfolders = [];
  for (const sub of UPLOAD_SUBFOLDERS) {
    if (await fs.pathExists(path.join(UPLOAD_PUBLIC_PATH, sub))) existingSubfolders.push(sub);
  }
  if (existingSubfolders.length === 0) {
    logInfo("[backup] No images/videos folders found under UPLOAD_PUBLIC_PATH - skipping uploads archive", { UPLOAD_PUBLIC_PATH });
    return false;
  }
  // -C so the tarball's internal paths start at "images/..."/"videos/...",
  // not the full absolute host path - makes restoring onto a different
  // server/path later just a matter of extracting into the new
  // UPLOAD_PUBLIC_PATH, unchanged.
  await execFileAsync("tar", ["-czf", destArchive, "-C", UPLOAD_PUBLIC_PATH, ...existingSubfolders]);
  return true;
}

// Deletes dated backup folders older than RETENTION_DAYS - without this, a
// daily backup left running for a few months quietly fills the disk, which
// is exactly the kind of thing nobody notices until the app itself can't
// write logs/uploads anymore.
async function pruneOldBackups() {
  const entries = await fs.readdir(BACKUP_DIR).catch(() => []);
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const dateFolderPattern = /^\d{4}-\d{2}-\d{2}$/;

  for (const entry of entries) {
    if (!dateFolderPattern.test(entry)) continue; // never touch anything that isn't one of ours
    const entryDate = new Date(entry + "T00:00:00Z").getTime();
    if (Number.isNaN(entryDate)) continue;
    if (entryDate < cutoff) {
      await fs.remove(path.join(BACKUP_DIR, entry));
      logInfo(`[backup] Pruned backup older than ${RETENTION_DAYS} days`, { folder: entry });
    }
  }
}

async function main() {
  if (!BACKUP_DIR) throw new Error("BACKUP_DIR is not set - see .env.example");

  const dateStr = toDateKey(new Date());
  const dayDir = path.join(BACKUP_DIR, dateStr);
  await fs.ensureDir(dayDir);

  const dbArchive = path.join(dayDir, "db.gz");
  const uploadsArchive = path.join(dayDir, "uploads.tar.gz");

  await runMongodump(dbArchive);
  const dbStats = await fs.stat(dbArchive);
  if (dbStats.size === 0) throw new Error("mongodump produced an empty archive - treating as a failed backup");

  const uploadsBackedUp = await backupUploads(uploadsArchive);

  await pruneOldBackups();

  logInfo("[backup] Daily backup completed", {
    date: dateStr,
    dbBytes: dbStats.size,
    uploadsBackedUp,
    dir: dayDir,
  });
  process.exitCode = 0;
}

main().catch(async (error) => {
  logError("[backup] Daily backup FAILED", error);
  await alertError("Dnevni backup baze/slika NIJE uspeo", { errorMessage: error.message });
  process.exitCode = 1;
});
