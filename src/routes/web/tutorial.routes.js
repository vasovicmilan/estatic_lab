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
// the URLs end in a real file extension (.mp4 / .jpg) on purpose: rate limiters (this app's own and the
// Cloudflare rule in front of it) treat "static" by extension, and a page with dozens of posters plus a
// video that is fetched in many Range requests must not count against a visitor's per-minute budget.
// Access is still decided per file in the controller, the extension carries no meaning for it.
router.get("/video/:id/:device/:lang.mp4", TutorialController.tutorialVideo);
router.get("/poster/:id/:device.jpg", TutorialController.tutorialPoster);

export default router;
