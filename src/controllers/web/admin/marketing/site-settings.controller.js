import siteSettingsService from "../../../../services/site-settings.service.js";
import { prepareSiteSettingsFormData } from "../../../../presenters/admin/marketing/site-settings.presenter.js";
import { logError, logInfo } from "../../../../utils/logger.util.js";
import auditLogService from "../../../../services/audit-log.service.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

export async function siteSettingsForm(req, res, next) {
  try {
    const settings = await siteSettingsService.getSiteSettingsForEdit();
    const formData = prepareSiteSettingsFormData(settings);

    return res.render("admin/_form", {
      pageTitle: "Sadržaj sajta",
      pageDescription: "Uređivanje naslovne (hero) slike početne strane",
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[siteSettingsForm] Greška pri učitavanju podešavanja sajta", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function updateSiteSettings(req, res, next) {
  try {
    const existing = await siteSettingsService.getSiteSettingsForEdit();

    // no new file chosen -> `image` stays undefined, which the service treats
    // as "keep whatever is already stored" (see site-settings.service.js's
    // updateHero) rather than wiping the hero image back to null
    const updated = await siteSettingsService.updateHero({
      image: req.uploadedFile ? req.uploadedFile.img : undefined,
      imageAlt: req.body.heroImageAlt !== undefined ? req.body.heroImageAlt.trim() : undefined,
    });

    logInfo("[updateSiteSettings] Podešavanja sajta ažurirana", { adminId: req.session?.user?.id, hasNewImage: !!req.uploadedFile });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "SITE_SETTINGS_UPDATED",
      entity: { type: "SiteSettings", id: "singleton" },
      changes: auditLogService.computeChanges(existing.hero, updated.hero, ["image", "imageAlt"]),
      req,
      success: true,
    });

    return flashAndRedirect(req, res, "success", "Sadržaj sajta je uspešno ažuriran", "/admin/sajt");
  } catch (error) {
    logError("[updateSiteSettings] Greška pri ažuriranju podešavanja sajta", error, { userId: req.session?.user?.id, body: req.body });

    if (error.statusCode) {
      const settings = await siteSettingsService.getSiteSettingsForEdit().catch(() => null);
      const formData = prepareSiteSettingsFormData(settings);
      return res.status(error.statusCode).render("admin/_form", {
        pageTitle: "Sadržaj sajta",
        pageDescription: "Uređivanje naslovne (hero) slike početne strane",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export default { siteSettingsForm, updateSiteSettings };