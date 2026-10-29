# Video tutorials ("Educational corner")

The platform explains itself: **short videos show, step by step, exactly where to click**, on a computer and on a phone, with subtitles in Serbian and English. The videos are not made by hand: **the system records them itself through a real browser** (Playwright), so when a screen changes, the tutorial is rebuilt with a single command and does not go stale. The application shows them on the **`/uputstva`** page, each visitor seeing only what they are allowed to.

## Who sees what

| Visitor | Sees tutorials for |
|---|---|
| Guest | all visitors (`public`) |
| Logged-in user | `public` + logged-in users (`user`) |
| Partner | `public` + `user` + partners (`partner`) |
| Employee | `public` + `user` + employees (`employee`) |
| Administrator (permission `access_admin_panel`) | everything, including `admin` |

Who a tutorial is for is set in `e2e-tutorials/audience.json` (scenario name → audience). A scenario not listed there is published as `admin` (the strictest), with a warning at publish time. A new scenario is one line in that file.

## Why not a plain static folder

A static folder (`src/public`) hands every file to anyone who guesses the address, so an administrator tutorial would be public. So the videos live **outside `src/public`**, in `storage/tutorials` (or wherever `TUTORIALS_DIR` in `.env` points), and are delivered only through routes that check access:

- `GET /uputstva` is the list page, filtered per visitor.
- `GET /uputstva/video/:id/:device/:lang` is the video itself, and `GET /uputstva/poster/:id/:device` the thumbnail.

Rules in `src/services/tutorial-video.service.js`:

- **A check for every file, not only for the page.** Someone who guesses the address of an admin video without the right gets 403, an unknown video 404.
- **The address never builds a path.** `id`, device and language only select an entry of `manifest.json`. The path from the manifest is then checked once more to stay inside the folder (protection against "../").
- **Caching:** public videos may be cached, others only in the viewer's own browser (`private`), so a shared cache cannot serve someone else's content. The list page is not cached at all, because it depends on who is logged in.
- **Seeking works** (HTTP `Range` requests), which `<video>` needs.
- The page is `noindex`.

If an entry has no version for the chosen device (e.g. computer only), the page shows the existing version with a note, instead of an empty box.

## How they are made (one command)

```bash
npm run tutorials:all
```

It runs 6 steps in order: recording all scenarios (computer 1920x1080 and phone 390x844), subtitles, merging the recordings of several actors (e.g. customer then admin) into one video, **burning the subtitles into the picture** (H.264 `.mp4`), markdown guides with screenshots and **publishing** to `storage/tutorials`. At the end it prints the time of each step. A scenario that fails does not stop the others. Options: `-- --only <part of the name>` for one or several scenarios, `-- --skip-record` to skip recording (when only the text or subtitle size changes).

**How long it takes (measured, first full run with 41 recordings):** recording 1 h 06 min, merging 12 min, burning subtitles 20 min, publishing 14 s, **1 h 38 min in total**. `ffmpeg` and `ffprobe` are needed on the machine that records (not on the production server).

The detailed description of each step, of writing scenarios and narration is in `e2e-tutorials/README.md`.

## What is covered

24 tutorials are published: 3 public, 9 for users, 5 for partners, 3 for employees and 4 for administrators. The public, user and partner ones exist for the phone too, while the employee and administrator tutorials for now exist **for the computer only**. The administrator part is the most complex and stays last in line. The remaining scenarios (forgotten password, claiming an account, catalog search, the other administrator menu items) have not been recorded yet.

## Setting it up on the server

1. Record locally (`npm run tutorials:all`).
2. Transfer the `storage/tutorials` folder to the server (e.g. `rsync`).
3. In production set `TUTORIALS_DIR` to a persistent folder that survives deploys, and make sure the application can read it.

The `storage/` folder is in `.gitignore`: the videos are generated files and do not go into git. If there is no `manifest.json`, the page simply says the tutorials are not published yet (that is not an error).

## Known limitations

- Mobile versions for employees and administrators are missing (see above).
- The videos are made locally and transferred by hand; there is no automatic upload to the server.
- Subtitles are burned into the picture, so the viewer cannot turn them off, and the language is chosen by choosing another file.
- The recordings show the application with test data, not production data, and the names and prices in them are made up.
- Whether the picture flicker on the phone is really gone has not been confirmed by watching all the recordings.
