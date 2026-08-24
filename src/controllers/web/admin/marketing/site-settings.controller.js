import siteSettingsService from "../../../../services/site-settings.service.js";
import { prepareSiteSettingsFormData } from "../../../../presenters/admin/marketing/site-settings.presenter.js";
import { logError, logInfo } from "../../../../utils/logger.util.js";
import auditLogService from "../../../../services/audit-log.service.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

const PAGE_TITLE = "Sadržaj sajta";
const PAGE_DESCRIPTION = "Hero slika, politika zakazivanja i valuta";

export async function siteSettingsForm(req, res, next) {
  try {
    const settings = await siteSettingsService.getSiteSettingsForEdit();
    const formData = prepareSiteSettingsFormData(settings);

    return res.render("admin/_form", {
      pageTitle: PAGE_TITLE,
      pageDescription: PAGE_DESCRIPTION,
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
    const afterHero = await siteSettingsService.updateHero({
      image: req.uploadedFile ? req.uploadedFile.img : undefined,
      imageAlt: req.body.heroImageAlt !== undefined ? req.body.heroImageAlt.trim() : undefined,
    });

    // The real admin form (admin/_form.ejs) always submits every field
    // together as one page - but falling back to the existing stored value
    // for anything missing/non-numeric (rather than letting a NaN reach
    // Mongoose's schema validation as an uncaught error) keeps this endpoint
    // robust against a partial submission from anywhere else too.
    const numberOr = (value, fallback) => {
      const parsed = Number(value);
      return value !== undefined && !isNaN(parsed) ? parsed : fallback;
    };

    const updated = await siteSettingsService.updatePolicy({
      bookingPolicy: {
        bufferMinutes: numberOr(req.body.bufferMinutes, existing.bookingPolicy.bufferMinutes),
        slotGridMinutes: numberOr(req.body.slotGridMinutes, existing.bookingPolicy.slotGridMinutes),
        userCancellationCutoffHours: numberOr(req.body.userCancellationCutoffHours, existing.bookingPolicy.userCancellationCutoffHours),
        rescheduleCutoffHours: numberOr(req.body.rescheduleCutoffHours, existing.bookingPolicy.rescheduleCutoffHours),
        rescheduleSameDayFloorHours: numberOr(req.body.rescheduleSameDayFloorHours, existing.bookingPolicy.rescheduleSameDayFloorHours),
        rescheduleMinLeadMinutes: numberOr(req.body.rescheduleMinLeadMinutes, existing.bookingPolicy.rescheduleMinLeadMinutes),
      },
      currency: {
        code: req.body.currencyCode !== undefined ? req.body.currencyCode.trim() || existing.currency.code : existing.currency.code,
        symbol: req.body.currencySymbol !== undefined ? req.body.currencySymbol.trim() || existing.currency.symbol : existing.currency.symbol,
        symbolPosition: req.body.currencySymbolPosition || existing.currency.symbolPosition,
      },
    });

    logInfo("[updateSiteSettings] Podešavanja sajta ažurirana", { adminId: req.session?.user?.id, hasNewImage: !!req.uploadedFile });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "SITE_SETTINGS_UPDATED",
      entity: { type: "SiteSettings", id: "singleton" },
      changes: {
        ...auditLogService.computeChanges(existing.hero, afterHero.hero, ["image", "imageAlt"]),
        ...auditLogService.computeChanges(existing.bookingPolicy, updated.bookingPolicy, [
          "bufferMinutes",
          "slotGridMinutes",
          "userCancellationCutoffHours",
          "rescheduleCutoffHours",
          "rescheduleSameDayFloorHours",
          "rescheduleMinLeadMinutes",
        ]),
        ...auditLogService.computeChanges(existing.currency, updated.currency, ["code", "symbol", "symbolPosition"]),
      },
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
        pageTitle: PAGE_TITLE,
        pageDescription: PAGE_DESCRIPTION,
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export default { siteSettingsForm, updateSiteSettings };