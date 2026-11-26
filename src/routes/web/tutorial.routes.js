import { Router } from "express";
import * as TutorialController from "../../controllers/web/public/tutorial.controller.js";

const router = Router();

// Tutorials are for people using the site, not for search: robots.txt disallows /uputstva, and this header
// covers the cases robots.txt cannot (the page itself, and the .mp4/.jpg files, which have no <meta> tag).
router.use((req, res, next) => {
  res.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  next();
});

// req.user is already set (or absent for a guest) by optionalWebAuth in web.routes.js -
// access to each video is decided per file inside the controller, from the manifest's audience
router.get("/", TutorialController.tutorialsPage);
// These two are dynamic routes (access is decided per file in the controller), not static files. A page with
// dozens of posters plus a video fetched in many Range requests would eat the normal per-minute budget, so
// the app's globalLimiter gives exactly these two URL shapes their own, higher quota (isTutorialMedia in
// rate-limiter.middleware.js, RATE_LIMIT_MEDIA_MAX). Keep that pattern in sync with the two routes below.
// The .mp4/.jpg endings also let a Cloudflare rule treat them as media; they carry no meaning for access.
router.get("/video/:id/:device/:lang.mp4", TutorialController.tutorialVideo);
router.get("/poster/:id/:device.jpg", TutorialController.tutorialPoster);

export default router;
