import * as tutorialService from "../../../services/tutorial-video.service.js";
import { AppError } from "../../../utils/error.util.js";
import { logError } from "../../../utils/logger.util.js";
import { generateSeo } from "../../../seo/index.js";

/** GET /uputstva - the tutorials this visitor may see (guest, user, partner, employee, admin). */
export async function tutorialsPage(req, res, next) {
  try {
    const catalog = await tutorialService.getCatalogForUser(req.user);
    // the content depends on who is logged in - must never be cached by a shared cache
    res.set("Cache-Control", "private, no-store");
    // the list differs per visitor -> not something a search engine should index
    const seo = await generateSeo(
      "page",
      { title: "Uputstva i video tutorijali", description: "Video uputstva korak po korak: kako se koristi sajt i sistem, na računaru i na telefonu.", slug: req.originalUrl, noIndex: true },
      req
    );
    return res.render("public/tutorials", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: {
        catalog,
        isLoggedInUser: Boolean(req.user),
        breadcrumbs: [{ label: "Početna", url: "/" }, { label: "Uputstva" }],
      },
    });
  } catch (error) {
    logError("[tutorialsPage] Greška pri učitavanju uputstava", error);
    next(error);
  }
}

function sendTutorialFile(kind) {
  return async (req, res, next) => {
    try {
      const file = await tutorialService.resolveFile({ id: req.params.id, device: req.params.device, lang: req.params.lang, kind });
      // the same answer for "does not exist" and "not for you" would hide the existence of role-only
      // material, but a clear 403 is more useful to a logged-in person who followed a link - so:
      // unknown -> 404, known but not allowed -> 403 (guests get the login redirect on the page, not here)
      if (!file) return next(new AppError("Video nije pronađen", 404));
      if (!tutorialService.canView(req.user, file.audience)) {
        return next(new AppError("Nemate pravo pristupa ovom materijalu", 403));
      }

      res.set("Content-Type", file.contentType);
      // public material may be cached by anyone; role-only material only by the viewer's own browser
      // posters are small and rarely change: a longer cache means a repeat visit costs no requests at all
      const maxAge = kind === "poster" ? 86400 : 3600;
      res.set("Cache-Control", file.audience === "public" ? `public, max-age=${maxAge}` : `private, max-age=${maxAge}`);
      res.set("X-Content-Type-Options", "nosniff");
      // sendFile answers HTTP Range requests, which is what makes seeking in <video> work
      return res.sendFile(file.absPath, { dotfiles: "deny", cacheControl: false }, (err) => {
        if (err && !res.headersSent && err.code !== "ECONNABORTED") next(err);
      });
    } catch (error) {
      next(error);
    }
  };
}

/** GET /uputstva/video/:id/:device/:lang */
export const tutorialVideo = sendTutorialFile("video");
/** GET /uputstva/poster/:id/:device */
export const tutorialPoster = sendTutorialFile("poster");
