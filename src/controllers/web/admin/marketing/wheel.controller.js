import QRCode from "qrcode";
import wheelService from "../../../../services/wheel.service.js";
import { prepareWheelCouponListData } from "../../../../presenters/admin/marketing/wheel-coupon.presenter.js";
import { prepareWheelPrizeFormData } from "../../../../presenters/admin/marketing/wheel-prize.presenter.js";
import { prepareLeadListData, prepareLeadDetailsData, SORT_MAP } from "../../../../presenters/admin/marketing/lead.presenter.js";
import { resolveAdminLimit } from "../../../../utils/pagination.util.js";
import { resolveAdminSort } from "../../../../utils/admin-list.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { logError, logInfo } from "../../../../utils/logger.util.js";
import { BUSINESS } from "../../../../config/business.config.js";
import auditLogService from "../../../../services/audit-log.service.js";

const SOURCE_PATTERN = /^[a-z0-9_-]{1,60}$/i;

export async function listLeads(req, res, next) {
  try {
    const { search, segment, source, page = 1, limit } = req.query;
    const [result, sources] = await Promise.all([
      wheelService.listLeads({
        search: search || "",
        filters: { segment: segment || undefined, source: source || undefined },
        page: parseInt(page, 10) || 1,
        limit: resolveAdminLimit(limit),
        sort: resolveAdminSort(req.query, SORT_MAP),
      }),
      wheelService.listSources(),
    ]);
    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Točak sreće - kontakti",
      pageDescription: "Kontakti prikupljeni preko točka sreće",
      data: prepareLeadListData(result, req.query, sources),
    });
  } catch (error) {
    logError("[listLeads] Greška pri učitavanju kontakata sa točka", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function listWheelCoupons(req, res, next) {
  try {
    const { search, prize, state, page = 1, limit } = req.query;
    const result = await wheelService.listWheelCoupons({
      search: search || "",
      filters: { prize: prize || undefined, state: ["used", "active", "expired"].includes(state) ? state : undefined },
      page: parseInt(page, 10) || 1,
      limit: resolveAdminLimit(limit),
    });
    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Točak sreće - kuponi",
      pageDescription: "Jednokratni kuponi podeljeni preko točka sreće",
      data: prepareWheelCouponListData(result, req.query),
    });
  } catch (error) {
    logError("[listWheelCoupons] Greška pri učitavanju kupona sa točka", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function leadDetails(req, res, next) {
  try {
    const lead = await wheelService.getLeadById(req.params.leadId);
    return res.render("admin/_details", {
      pageTitle: `Kontakt - ${lead.osnovno.ime}`,
      pageDescription: lead.osnovno.email,
      data: prepareLeadDetailsData(lead),
    });
  } catch (error) {
    logError("[leadDetails] Greška pri učitavanju kontakta", error, { leadId: req.params.leadId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function deleteLead(req, res, next) {
  const { leadId } = req.params;
  try {
    await wheelService.deleteLead(leadId);
    await auditLogService.recordAuditLog({ actor: req.session?.user, action: "LEAD_DELETED", entity: { type: "Lead", id: leadId }, req, success: true });
    return flashAndRedirect(req, res, "success", "Kontakt je obrisan", "/admin/tocak");
  } catch (error) {
    logError("[deleteLead] Greška pri brisanju kontakta", error, { leadId, userId: req.session?.user?.id });
    if (error.statusCode) return flashAndRedirect(req, res, "error", error.message, "/admin/tocak");
    next(error);
  }
}

export async function exportLeads(req, res, next) {
  try {
    const { segment, source, search } = req.query;
    const csv = await wheelService.exportLeadsCsv({ segment: segment || undefined, source: source || undefined, search: search || "" });
    await auditLogService.recordAuditLog({ actor: req.session?.user, action: "LEADS_EXPORTED", entity: { type: "Lead", id: "export" }, req, success: true });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="tocak-kontakti-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(csv);
  } catch (error) {
    logError("[exportLeads] Greška pri izvozu kontakata", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function prizesPage(req, res, next) {
  try {
    const prizes = await wheelService.listPrizesForAdmin();
    const rawSource = typeof req.query.src === "string" ? req.query.src.trim() : "";
    const source = SOURCE_PATTERN.test(rawSource) ? rawSource : "sajam";
    const url = wheelUrl(source);
    const qrSvg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M", width: 320 });
    return res.render("admin/marketing/wheel-admin", {
      pageTitle: "Točak sreće - nagrade i QR",
      pageDescription: "Šanse, zalihe i QR kod za točak sreće",
      data: {
        prizes,
        source,
        url,
        qrSvg,
        csrfToken: res.locals.csrfToken,
        breadcrumbs: [
          { label: "Admin", url: "/admin" },
          { label: "Točak sreće", url: "/admin/tocak" },
          { label: "Nagrade i QR", url: null },
        ],
      },
    });
  } catch (error) {
    logError("[prizesPage] Greška pri učitavanju nagrada točka", error, { userId: req.session?.user?.id });
    next(error);
  }
}

function wheelUrl(source) {
  return `${BUSINESS.siteUrl.replace(/\/+$/, "")}/tocak?src=${encodeURIComponent(source)}`;
}

// printable QR: /admin/tocak/qr.svg?src=sajam-ns-2026 or /admin/tocak/qr.png?src=...
export async function qrDownload(req, res, next) {
  try {
    const rawSource = typeof req.query.src === "string" ? req.query.src.trim() : "";
    const source = SOURCE_PATTERN.test(rawSource) ? rawSource : "sajam";
    const url = wheelUrl(source);
    if (req.params.format === "png") {
      const png = await QRCode.toBuffer(url, { type: "png", margin: 3, errorCorrectionLevel: "M", width: 1200 });
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Disposition", `attachment; filename="tocak-qr-${source}.png"`);
      return res.send(png);
    }
    const svg = await QRCode.toString(url, { type: "svg", margin: 3, errorCorrectionLevel: "M" });
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Content-Disposition", `attachment; filename="tocak-qr-${source}.svg"`);
    return res.send(svg);
  } catch (error) {
    logError("[qrDownload] Greška pri generisanju QR koda", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function updatePrize(req, res, next) {
  const { prizeId } = req.params;
  try {
    if (req.validationErrors) {
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), "/admin/tocak/nagrade");
    }
    const { weight, stock, validDays, isActive } = req.body;
    await wheelService.updatePrize(prizeId, {
      weight,
      stock: stock === undefined || stock === "" || Number.isNaN(stock) ? null : stock,
      validDays,
      isActive: !!isActive,
    });
    logInfo(`[updatePrize] Nagrada #${prizeId} izmenjena`, { prizeId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "WHEEL_PRIZE_UPDATED",
      entity: { type: "WheelPrize", id: prizeId },
      changes: { weight, stock, validDays, isActive: !!isActive },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Nagrada je sačuvana", "/admin/tocak/nagrade");
  } catch (error) {
    logError("[updatePrize] Greška pri izmeni nagrade", error, { prizeId, userId: req.session?.user?.id });
    if (error.statusCode) return flashAndRedirect(req, res, "error", error.message, "/admin/tocak/nagrade");
    next(error);
  }
}

async function renderPrizeForm(res, { prize = null, extra = {}, status = 200, pageTitle }) {
  const serviceOptions = await wheelService.listServiceOptions();
  const form = prepareWheelPrizeFormData(prize, { serviceOptions });
  return res.status(status).render("admin/_form", {
    pageTitle,
    pageDescription: "Nagrada točka sreće",
    data: { ...form, errors: {}, csrfToken: res.locals.csrfToken, ...extra },
  });
}

export async function newPrizeForm(req, res, next) {
  try {
    return await renderPrizeForm(res, { pageTitle: "Nova nagrada točka" });
  } catch (error) {
    logError("[newPrizeForm] Greška", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function editPrizeForm(req, res, next) {
  try {
    const prize = await wheelService.getPrizeForEdit(req.params.prizeId);
    return await renderPrizeForm(res, { prize, pageTitle: "Izmena nagrade točka" });
  } catch (error) {
    logError("[editPrizeForm] Greška", error, { prizeId: req.params.prizeId, userId: req.session?.user?.id });
    if (error.statusCode) return flashAndRedirect(req, res, "error", error.message, "/admin/tocak/nagrade");
    next(error);
  }
}

export async function createPrize(req, res, next) {
  try {
    if (req.validationErrors) {
      return await renderPrizeForm(res, { status: 400, pageTitle: "Nova nagrada točka", extra: { errors: req.validationErrors, formData: req.body } });
    }
    const prize = await wheelService.createPrize(req.body);
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "WHEEL_PRIZE_CREATED",
      entity: { type: "WheelPrize", id: prize.id },
      changes: { key: prize.key, label: prize.label, weight: prize.weight, stock: prize.stock, isFallback: prize.isFallback },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Nagrada je dodata na točak", "/admin/tocak/nagrade");
  } catch (error) {
    logError("[createPrize] Greška pri dodavanju nagrade", error, { userId: req.session?.user?.id });
    if (error.statusCode === 400 || error.statusCode === 409) {
      return await renderPrizeForm(res, { status: 400, pageTitle: "Nova nagrada točka", extra: { errors: { general: error.message }, formData: req.body } });
    }
    next(error);
  }
}

export async function updatePrizeFull(req, res, next) {
  const { prizeId } = req.params;
  try {
    const current = await wheelService.getPrizeForEdit(prizeId);
    if (req.validationErrors) {
      return await renderPrizeForm(res, { prize: current, status: 400, pageTitle: "Izmena nagrade točka", extra: { errors: req.validationErrors, formData: req.body } });
    }
    const { before, after } = await wheelService.updatePrizeFull(prizeId, req.body);
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "WHEEL_PRIZE_UPDATED",
      entity: { type: "WheelPrize", id: prizeId },
      changes: { before, after },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Nagrada je sačuvana", "/admin/tocak/nagrade");
  } catch (error) {
    logError("[updatePrizeFull] Greška pri izmeni nagrade", error, { prizeId, userId: req.session?.user?.id });
    if (error.statusCode === 400 || error.statusCode === 409) {
      const current = await wheelService.getPrizeForEdit(prizeId).catch(() => null);
      return await renderPrizeForm(res, { prize: current, status: 400, pageTitle: "Izmena nagrade točka", extra: { errors: { general: error.message }, formData: req.body } });
    }
    if (error.statusCode) return flashAndRedirect(req, res, "error", error.message, "/admin/tocak/nagrade");
    next(error);
  }
}

export async function deletePrize(req, res, next) {
  const { prizeId } = req.params;
  try {
    const prize = await wheelService.deletePrize(prizeId);
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "WHEEL_PRIZE_DELETED",
      entity: { type: "WheelPrize", id: prizeId },
      changes: { key: prize.key, label: prize.label },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Nagrada je obrisana", "/admin/tocak/nagrade");
  } catch (error) {
    logError("[deletePrize] Greška pri brisanju nagrade", error, { prizeId, userId: req.session?.user?.id });
    if (error.statusCode) return flashAndRedirect(req, res, "error", error.message, "/admin/tocak/nagrade");
    next(error);
  }
}

export default { listLeads, listWheelCoupons, leadDetails, deleteLead, exportLeads, prizesPage, qrDownload, updatePrize, newPrizeForm, editPrizeForm, createPrize, updatePrizeFull, deletePrize };
