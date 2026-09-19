# Backups

**Phase 1 (this doc): local, same-server, daily.** A dated snapshot of the database and the uploaded images/videos, written to a directory on the same server the app runs on, pruned automatically after a retention window. This is deliberately the first step, not the whole story - it protects against the app or database getting into a bad state (a bad migration, an accidental bulk delete, corrupted data), but not against the server itself dying or the disk failing. Syncing these dated folders somewhere offsite (a second machine, USB, Google Drive) is Phase 2, intentionally not built yet - it's worth getting Phase 1 running and confirmed for a few days first.

## What gets backed up, and why

- **The database** - a full `mongodump`, gzip-compressed into a single archive file (`db.gz`). Everything in MongoDB: users, appointments, orders, products, services, settings, the lot.
- **Uploaded images/videos** - a gzip tarball (`uploads.tar.gz`) of just the `images/` and `videos/` subfolders under `UPLOAD_PUBLIC_PATH` (see `multer.config.js` for the full subfolder list - services, packages, products, categories, posts, testimonials, experts, partners, site, video thumbnails).

**What's deliberately NOT included**: the rest of `src/public/` (compiled CSS, the icon-subset font, any other build output). `DEPLOYMENT.md` already documents that those are regenerated per server via `npm run build:css` / `npm run build:icons` - they aren't data, they're build artifacts, and backing them up would just make every day's backup bigger for no reason.

## Running it

```bash
npm run backup:daily
```

This runs `scripts/backup.js`, which:

1. Reads `BACKUP_DIR` and `MONGO_URI` from the environment (`.env` - see `.env.example`). Refuses to run if `BACKUP_DIR` isn't set, rather than guessing a default - a backup script should never write somewhere unexpected.
2. Creates `BACKUP_DIR/YYYY-MM-DD/` for today.
3. Runs `mongodump --uri=$MONGO_URI --archive=.../db.gz --gzip`. If this fails, or produces an empty file, the whole run is treated as failed (exit code 1, a Telegram alert via the existing operational-alerts channel - see `09-admin-operations.md`) and nothing else happens - in particular, old backups are **not** pruned on a failed run, so a bad night never costs you last week's good backups too.
4. Tars up `images/`/`videos/` into `uploads.tar.gz` (skipped, not treated as an error, if neither folder exists yet - a brand-new deployment with no uploads yet).
5. Deletes any dated folder older than `BACKUP_RETENTION_DAYS` (default 14).

## Server setup (once per server)

**Install the MongoDB Database Tools** (provides `mongodump`/`mongorestore`) - this is an OS-level package, separate from anything in `package.json`, since it talks MongoDB's wire protocol directly rather than going through Mongoose:

```bash
# Debian/Ubuntu
wget -qO- https://www.mongodb.org/static/pgp/server-7.0.asc | sudo tee /etc/apt/trusted.gpg.d/mongodb.asc
echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update && sudo apt-get install -y mongodb-database-tools
```

Confirm with `mongodump --version`.

**Set the env vars** in the server's `.env` (see `.env.example`):

```
BACKUP_DIR=/var/backups/estatic-lab
BACKUP_RETENTION_DAYS=14
```

Make sure `BACKUP_DIR` exists and is writable by whichever user runs the cron job (the script creates the dated subfolders itself, but the parent needs to already be there and writable).

**Add the cron entry** - a nightly, off-peak time, running as the app's own deploy user (so file ownership matches everything else the app writes):

```bash
crontab -e
# Every night at 03:30 server time:
30 3 * * * cd /path/to/estatic_lab && /usr/bin/npm run backup:daily >> /var/log/estatic-lab-backup.log 2>&1
```

This is deliberately **system cron**, not `node-cron` inside the app (unlike the other scheduled jobs in `jobs/scheduler.js` - see `10-logs-and-audit-trail.md`). A backup's schedule shouldn't depend on the app process being up and healthy - if the app has crashed, that's exactly the night you still want the backup to run.

## Restoring

Given a dated backup folder, e.g. `/var/backups/estatic-lab/2026-09-19/`:

```bash
# Database - restores into whatever MONGO_URI points at. --drop replaces
# existing collections rather than merging into them, which is almost always
# what you want for a restore.
mongorestore --uri="$MONGO_URI" --archive=/var/backups/estatic-lab/2026-09-19/db.gz --gzip --drop

# Uploads - extracts images/ and videos/ back into place. UPLOAD_PUBLIC_PATH
# defaults to src/public if unset (see .env.example).
tar -xzf /var/backups/estatic-lab/2026-09-19/uploads.tar.gz -C "$UPLOAD_PUBLIC_PATH"
```

Restoring onto a different server (a fresh migration, not just recovering the same box) works the same way - the tarball's paths start at `images/...`/`videos/...`, not the original server's absolute path, so it drops cleanly into any `UPLOAD_PUBLIC_PATH`.

## What's still missing (Phase 2, not built yet)

- **Offsite copies**: today, a backup living on the same disk as the database it backs up doesn't protect against that disk/server failing entirely. Syncing `BACKUP_DIR` to a second location (another machine, a mounted USB drive, `rclone` to Google Drive, etc.) is the natural next step, once Phase 1 has been observed running successfully for a few days.
- **Restore drills**: nothing here has been exercised against a real production database yet (this doc's restore commands are correct MongoDB Database Tools usage, but "the commands are correct" and "we've actually done this once" are different levels of confidence) - worth doing a real restore-to-a-throwaway-database dry run before relying on this in an actual emergency.
