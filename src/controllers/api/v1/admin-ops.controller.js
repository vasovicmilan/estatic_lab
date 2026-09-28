import * as appointmentService from "../../../services/appointment.service.js";
import * as contactService from "../../../services/contact.service.js";
import * as employeeService from "../../../services/employee.service.js";
import * as userService from "../../../services/user.service.js";
import packagePurchaseService from "../../../services/package-purchase.service.js";
import orderService from "../../../services/order.service.js";
import productService from "../../../services/product.service.js";
import payoutRequestService from "../../../services/payout-request.service.js";
import * as testimonialService from "../../../services/testimonial.service.js";
import resourceService from "../../../services/resource.service.js";
import * as newsletterService from "../../../services/news-letter.service.js";
import auditLogService from "../../../services/audit-log.service.js";
import logReportService from "../../../services/log-report.service.js";
import businessReportService from "../../../services/business-report.service.js";
import siteSettingsService from "../../../services/site-settings.service.js";
import siteContentService from "../../../services/site-content.service.js";
import { logError, logInfo } from "../../../utils/logger.util.js";
import { AppError } from "../../../utils/error.util.js";
import { getStartOfDayInZone, getEndOfDayInZone } from "../../../utils/date.time.util.js";
import { resolvePage, resolveLimit, pickPaginationMeta } from "../../../utils/pagination.util.js";
import { buildAuditActor } from "../../../utils/audit-actor.util.js";
import { generateBusinessReportPdf } from "../../../utils/business-report-pdf.util.js";

// Mirrors controllers/web/admin/{dashboard,marketing/payout-request,logs/*,
// reports/business-report,marketing/site-settings,profile}.controller.js - same
// services, same audit log entries. Returns the raw service data (counts, lists)
// rather than routing it through the HTML presenters (prepareDashboardData etc.) -
// those add icons/labels/HTML-table shape a JSON client has no use for.
// downloadBusinessReportPdf below is the one deliberate exception - a binary
// file response rather than JSON, exposed anyway because the Angular admin
// panel (unlike a JSON API consumer) needs a way to actually download the PDF
// (see business-report.controller.js's web-only businessReportDownloadPdf,
// which this mirrors) - image upload stays genuinely out of scope elsewhere.

// ================== Dashboard ==================

function todayBounds() {
  const start = getStartOfDayInZone();
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function dashboard(req, res, next) {
  try {
    const { start: todayStart, end: todayEnd } = todayBounds();

    const [
      pending, confirmed, unassigned, today, contacts, employees, users, purchases,
      pendingOrders, outOfStockProducts, pendingPayoutRequests, pendingTestimonials,
      inactiveResources, subscribers, recentPending, recentUnassigned, recentContacts, recentOrders,
    ] = await Promise.all([
      appointmentService.findAppointments({ role: "admin", filters: { status: "pending" }, limit: 1 }),
      appointmentService.findAppointments({ role: "admin", filters: { status: "confirmed" }, limit: 1 }),
      appointmentService.findAppointments({ role: "admin", filters: { unassignedOnly: true }, limit: 1 }),
      appointmentService.findAppointments({ role: "admin", filters: { dateFrom: todayStart, dateTo: todayEnd }, limit: 1 }),
      contactService.listContacts({ filters: { status: "new" }, limit: 1 }),
      employeeService.listEmployees({ filters: { isActive: true }, limit: 1 }),
      userService.listUsers({ limit: 1 }),
      packagePurchaseService.listPurchases({ filters: { status: "active" }, limit: 1 }),
      orderService.findOrders({ role: "admin", filters: { status: "pending" }, limit: 1 }),
      productService.listProducts({ filters: { inStock: false, isActive: true }, limit: 1 }),
      payoutRequestService.listPayoutRequests({ filters: { status: "requested" }, limit: 1 }),
      testimonialService.listTestimonials({ filters: { status: "pending" }, limit: 1 }),
      resourceService.listResources({ isActive: false, limit: 1 }),
      newsletterService.listSubscribers({ limit: 1 }),
      appointmentService.findAppointments({ role: "admin", filters: { status: "pending" }, limit: 5 }),
      appointmentService.findAppointments({ role: "admin", filters: { unassignedOnly: true }, limit: 5 }),
      contactService.listContacts({ filters: { status: "new" }, limit: 5 }),
      orderService.findOrders({ role: "admin", filters: { status: "pending" }, limit: 5 }),
    ]);

    const stats = {
      pendingAppointments: pending.total,
      confirmedAppointments: confirmed.total,
      unassignedAppointments: unassigned.total,
      todayAppointments: today.total,
      newContacts: contacts.total,
      activeEmployees: employees.total,
      totalUsers: users.total,
      activePackagePurchases: purchases.total,
      pendingOrders: pendingOrders.total,
      outOfStockProducts: outOfStockProducts.total,
      pendingPayoutRequests: pendingPayoutRequests.total,
      pendingTestimonials: pendingTestimonials.total,
      inactiveResources: inactiveResources.total,
      newsletterSubscribers: subscribers.total,
    };

    return res.json({
      success: true,
      data: {
        stats,
        recent: { pendingAppointments: recentPending.data, unassignedAppointments: recentUnassigned.data, contacts: recentContacts.data, orders: recentOrders.data },
      },
    });
  } catch (error) {
    logError("[api/admin/dashboard] Greška", error);
    next(error);
  }
}

// ================== Payout requests ==================

// Same whitelist pattern as admin-catalog.controller.js's PRODUCT_SORT_FIELDS -
// `earnerType`/`status` are plain scalar columns, `iznos`/`zatrazeno` map to the
// scalar `amount`/`requestedAt` fields on the PayoutRequest schema. `earnerName`
// (resolved from employeeSnapshot or a populated employee/partner->userId name)
// is NOT included - not a scalar column a repository can sort on directly.
const PAYOUT_SORT_FIELDS = { earnerType: "earnerType", iznos: "amount", status: "status", zatrazeno: "requestedAt" };

export async function listPayoutRequests(req, res, next) {
  try {
    const { status, earnerType, partnerId, employeeId, page = 1, limit = 10, sort, order } = req.query;
    const sortField = PAYOUT_SORT_FIELDS[sort];
    const result = await payoutRequestService.listPayoutRequests({
      filters: { status: status || undefined, earnerType: earnerType || undefined, partner: partnerId || undefined, employee: employeeId || undefined },
      page: resolvePage(page),
      limit: resolveLimit(limit),
      sort: sortField ? { [sortField]: order === "asc" ? 1 : -1 } : undefined,
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listPayoutRequests] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getPayoutRequest(req, res, next) {
  try {
    const request = await payoutRequestService.getPayoutRequestById(req.params.requestId);
    return res.json({ success: true, data: request });
  } catch (error) {
    logError("[api/admin/getPayoutRequest] Greška", error, { requestId: req.params.requestId });
    next(error);
  }
}

export async function approvePayoutRequest(req, res, next) {
  try {
    const { requestId } = req.params;
    const updated = await payoutRequestService.approvePayoutRequest(requestId, req.body.reason || "");
    logInfo(`[api/admin/approvePayoutRequest] Zahtev #${requestId} odobren`, { requestId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "PAYOUT_APPROVED", entity: { type: "PayoutRequest", id: requestId }, changes: { status: { old: "requested", new: "approved" } } });
    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/approvePayoutRequest] Greška", error, { requestId: req.params.requestId });
    next(error);
  }
}

export async function markPayoutRequestPaid(req, res, next) {
  try {
    const { requestId } = req.params;
    const updated = await payoutRequestService.markPayoutRequestPaid(requestId, req.body.reason || "");
    logInfo(`[api/admin/markPayoutRequestPaid] Zahtev #${requestId} isplaćen`, { requestId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "PAYOUT_PAID", entity: { type: "PayoutRequest", id: requestId }, changes: { status: { old: null, new: "paid" } } });
    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/markPayoutRequestPaid] Greška", error, { requestId: req.params.requestId });
    next(error);
  }
}

export async function rejectPayoutRequest(req, res, next) {
  try {
    const { requestId } = req.params;
    const updated = await payoutRequestService.rejectPayoutRequest(requestId, req.body.reason || "");
    logInfo(`[api/admin/rejectPayoutRequest] Zahtev #${requestId} odbijen`, { requestId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "PAYOUT_REJECTED", entity: { type: "PayoutRequest", id: requestId }, changes: { status: { old: null, new: "rejected" } } });
    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/rejectPayoutRequest] Greška", error, { requestId: req.params.requestId });
    next(error);
  }
}

export async function recordPayoutDirectly(req, res, next) {
  try {
    const { earnerType, earnerId, amount, note } = req.body;
    await payoutRequestService.recordPayoutByAdmin(earnerType, earnerId, Number(amount), note || "");
    logInfo("[api/admin/recordPayoutDirectly] Isplata direktno zabeležena", { earnerType, earnerId, amount, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "PAYOUT_RECORDED_DIRECTLY",
      entity: { type: earnerType === "employee" ? "Employee" : "Partner", id: earnerId },
      changes: { amount: { old: null, new: Number(amount) }, note: { old: null, new: note || null } },
    });
    return res.status(201).json({ success: true, data: { message: "Isplata je zabeležena." } });
  } catch (error) {
    logError("[api/admin/recordPayoutDirectly] Greška", error, { body: req.body });
    next(error);
  }
}

// ================== Audit log ==================

export async function listAuditLogs(req, res, next) {
  try {
    const { page = 1, limit = 25, action, success, actorId, actorRole, entityType, entityId, search, dateFrom, dateTo, sortOrder } = req.query;
    const [result, availableActions] = await Promise.all([
      auditLogService.listAuditLogs({
        filters: {
          action: action || undefined,
          success: success === "" || success === undefined ? undefined : success === "true",
          actorId: actorId || undefined,
          actorRole: actorRole || undefined,
          entityType: entityType || undefined,
          entityId: entityId || undefined,
          search: search || undefined,
          dateFrom: dateFrom ? getStartOfDayInZone(dateFrom) : undefined,
          dateTo: dateTo ? getEndOfDayInZone(dateTo) : undefined,
          sortOrder: sortOrder === "asc" ? "asc" : "desc",
        },
        page: resolvePage(page),
        limit: resolveLimit(limit),
      }),
      auditLogService.listDistinctActions(),
    ]);
    return res.json({ success: true, data: result.data, meta: { ...pickPaginationMeta(result), availableActions } });
  } catch (error) {
    logError("[api/admin/listAuditLogs] Greška", error, { query: req.query });
    next(error);
  }
}

// ================== Log summaries (traffic/error digest) ==================

export async function getLogDashboard(req, res, next) {
  try {
    const todaySummary = await logReportService.getTodaySummary();
    return res.json({ success: true, data: todaySummary });
  } catch (error) {
    logError("[api/admin/getLogDashboard] Greška", error);
    next(error);
  }
}

// Same whitelist pattern as PRODUCT_SORT_FIELDS - `total`/`errors`/`avgMs` map to
// plain nested-but-scalar fields already stored on each LogSummary doc
// (requests.total/logs.errorCount/perf.avgResponseTimeMs are computed once at
// generateDailySummary time and persisted, not computed at query time), same
// dot-path pattern as admin-taxonomy.controller.js's CATEGORY_SORT_FIELDS.
const LOG_SUMMARY_SORT_FIELDS = { date: "date", total: "requests.total", errors: "logs.errorCount", avgMs: "perf.avgResponseTimeMs" };

export async function listLogSummaries(req, res, next) {
  try {
    const { page = 1, limit = 20, sort, order } = req.query;
    const sortField = LOG_SUMMARY_SORT_FIELDS[sort];
    const result = await logReportService.listLogSummaries({
      page: resolvePage(page),
      limit: resolveLimit(limit),
      sort: sortField ? { [sortField]: order === "asc" ? 1 : -1 } : undefined,
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listLogSummaries] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getLogSummary(req, res, next) {
  try {
    const summary = await logReportService.getLogSummaryByDate(req.params.date);
    if (!summary) return next(new AppError(`Nema sačuvanog izveštaja za ${req.params.date}`, 404));
    return res.json({ success: true, data: summary });
  } catch (error) {
    logError("[api/admin/getLogSummary] Greška", error, { date: req.params.date });
    next(error);
  }
}

// ================== Business reports ==================

const REPORT_PERIOD_TYPES = ["daily", "weekly", "monthly", "quarterly", "yearly"];
const REPORT_PERIOD_LABELS = {
  daily: "Dnevni poslovni izveštaj",
  weekly: "Nedeljni poslovni izveštaj",
  monthly: "Mesečni poslovni izveštaj",
  quarterly: "Kvartalni poslovni izveštaj",
  yearly: "Godišnji poslovni izveštaj",
};

export async function getBusinessReportDashboard(req, res, next) {
  try {
    const entries = await Promise.all(REPORT_PERIOD_TYPES.map(async (periodType) => [periodType, await businessReportService.getCurrentPeriodSummaryLive(periodType)]));
    return res.json({ success: true, data: Object.fromEntries(entries) });
  } catch (error) {
    logError("[api/admin/getBusinessReportDashboard] Greška", error);
    next(error);
  }
}

// Same whitelist pattern as PRODUCT_SORT_FIELDS - `periodKey` is a plain scalar
// column; `appointmentsRevenue`/`ordersRevenue` map to nested-but-scalar fields
// already stored on each BusinessReportSummary doc (computed once at
// generateSummary time and persisted, not aggregated at read time), same
// dot-path pattern as admin-taxonomy.controller.js's CATEGORY_SORT_FIELDS.
const BUSINESS_REPORT_SORT_FIELDS = { periodKey: "periodKey", appointmentsRevenue: "appointments.revenue", ordersRevenue: "orders.revenue" };

export async function listBusinessReports(req, res, next) {
  try {
    const { periodType } = req.params;
    if (!REPORT_PERIOD_TYPES.includes(periodType)) return next(new AppError("Nepoznat tip perioda", 400));

    const { page = 1, limit = 20, sort, order } = req.query;
    const sortField = BUSINESS_REPORT_SORT_FIELDS[sort];
    const result = await businessReportService.listSummaries(periodType, {
      page: resolvePage(page),
      limit: resolveLimit(limit),
      sort: sortField ? { [sortField]: order === "asc" ? 1 : -1 } : undefined,
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listBusinessReports] Greška", error, { periodType: req.params.periodType, query: req.query });
    next(error);
  }
}

export async function getBusinessReport(req, res, next) {
  try {
    const { periodType, periodKey } = req.params;
    if (!REPORT_PERIOD_TYPES.includes(periodType)) return next(new AppError("Nepoznat tip perioda", 400));

    const summary = await businessReportService.getSummary(periodType, periodKey);
    if (!summary) return next(new AppError(`Nema sačuvanog izveštaja za ${periodKey}`, 404));
    return res.json({ success: true, data: summary });
  } catch (error) {
    logError("[api/admin/getBusinessReport] Greška", error, { periodType: req.params.periodType, periodKey: req.params.periodKey });
    next(error);
  }
}

/** GET /admin/business-reports/:periodType/:periodKey/pdf - binary response,
 * see this file's header comment for why it's the one exception to the
 * JSON-only convention here. Mirrors businessReportDownloadPdf in
 * controllers/web/admin/reports/business-report.controller.js exactly (same
 * raw, unformatted summary fed to generateBusinessReportPdf, which formats
 * every number itself - feeding it pre-formatted strings would double-format
 * them). */
export async function downloadBusinessReportPdf(req, res, next) {
  try {
    const { periodType, periodKey } = req.params;
    if (!REPORT_PERIOD_TYPES.includes(periodType)) return next(new AppError("Nepoznat tip perioda", 400));

    const summary = await businessReportService.getSummary(periodType, periodKey);
    if (!summary) return next(new AppError(`Nema sačuvanog izveštaja za ${periodKey}`, 404));

    const rangeLabel = `${new Date(summary.periodStart).toLocaleDateString("sr-RS")} - ${new Date(summary.periodEnd.getTime() - 1).toLocaleDateString("sr-RS")}`;
    const pdfBuffer = await generateBusinessReportPdf(REPORT_PERIOD_LABELS[periodType], rangeLabel, summary);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="poslovni-izvestaj-${periodKey}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    logError("[api/admin/downloadBusinessReportPdf] Greška", error, { periodType: req.params.periodType, periodKey: req.params.periodKey });
    next(error);
  }
}

// ================== Site settings ==================

export async function getSiteSettings(req, res, next) {
  try {
    const settings = await siteSettingsService.getSiteSettingsForEdit();
    return res.json({ success: true, data: settings });
  } catch (error) {
    logError("[api/admin/getSiteSettings] Greška", error);
    next(error);
  }
}

export async function updateSiteSettings(req, res, next) {
  try {
    const existing = await siteSettingsService.getSiteSettingsForEdit();

    // Same "hero image reference, not an upload" reasoning as everywhere else in
    // this API (see admin-people.controller.js's header comment) - req.body.image
    // is a { img, imgDesc }-shaped already-hosted reference, not multer's
    // req.uploadedFile. Omitted entirely (undefined) means "keep what's stored".
    const afterHero = await siteSettingsService.updateHero({
      image: req.body.heroImage?.img !== undefined ? req.body.heroImage.img : undefined,
      imageAlt: req.body.heroImageAlt !== undefined ? req.body.heroImageAlt.trim() : undefined,
    });

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
      commissionPolicy: { minimumSessionCommission: numberOr(req.body.minimumSessionCommission, existing.commissionPolicy.minimumSessionCommission) },
    });

    logInfo("[api/admin/updateSiteSettings] Podešavanja sajta ažurirana", { adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "SITE_SETTINGS_UPDATED",
      entity: { type: "SiteSettings", id: "singleton" },
      changes: {
        ...auditLogService.computeChanges(existing.hero, afterHero.hero, ["image", "imageAlt"]),
        ...auditLogService.computeChanges(existing.bookingPolicy, updated.bookingPolicy, [
          "bufferMinutes", "slotGridMinutes", "userCancellationCutoffHours", "rescheduleCutoffHours", "rescheduleSameDayFloorHours", "rescheduleMinLeadMinutes",
        ]),
        ...auditLogService.computeChanges(existing.currency, updated.currency, ["code", "symbol", "symbolPosition"]),
        ...auditLogService.computeChanges(existing.commissionPolicy, updated.commissionPolicy, ["minimumSessionCommission"]),
      },
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/updateSiteSettings] Greška", error, { body: req.body });
    next(error);
  }
}

/**
 * Mirrors controllers/web/admin/marketing/site-settings.controller.js's own
 * updateWorkingHours - same service call, same audit log entry, JSON response
 * shape instead of a flash+redirect. Request-shape validation already ran
 * (validateWorkingHoursUpdate + handleApiValidationErrors, see
 * admin-ops.routes.js), so a thrown error past this point is a genuine
 * business-rule rejection (missing day, from >= to...), which next(error)
 * hands to the same {success:false, error:{...}} shape every other /api/v1
 * error uses (see error.util.js/AppError, not a bespoke shape here).
 */
export async function updateWorkingHours(req, res, next) {
  try {
    const existing = await siteSettingsService.getSiteSettingsForEdit();
    const updated = await siteSettingsService.updateWorkingHours(req.body.workingHours);

    logInfo("[api/admin/updateWorkingHours] Radno vreme salona (prikaz) ažurirano", { adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "SITE_SETTINGS_WORKING_HOURS_UPDATED",
      entity: { type: "SiteSettings", id: "singleton" },
      changes: { workingHours: { before: existing.workingHours, after: updated.workingHours } },
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/updateWorkingHours] Greška", error, { body: req.body });
    next(error);
  }
}

/**
 * Mirrors updateClosedDates on the web side - full-list replace of the
 * salon's one-off closures/praznici, same audit log entry.
 */
export async function updateClosedDates(req, res, next) {
  try {
    const existing = await siteSettingsService.getSiteSettingsForEdit();
    const updated = await siteSettingsService.updateClosedDates(req.body.closedDates);

    logInfo("[api/admin/updateClosedDates] Neradni dani salona ažurirani", { adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "SITE_SETTINGS_CLOSED_DATES_UPDATED",
      entity: { type: "SiteSettings", id: "singleton" },
      changes: { closedDates: { before: existing.closedDates, after: updated.closedDates } },
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/updateClosedDates] Greška", error, { body: req.body });
    next(error);
  }
}

// ================== Site content (About/FAQ/Privacy/Terms/Partnership/home intro/"why us"/team intro) ==================
// Mirrors the site-settings block above: one GET returning everything (the
// admin edit screen loads all sections in one call, same reasoning as
// getSiteSettingsForEdit), one PUT per section so a save only ever touches
// the section it's editing and can't accidentally clobber another one.
// Every update function writes an audit log entry the same shape as
// SITE_SETTINGS_*_UPDATED above, using the section name as the action so the
// audit trail says exactly which page's copy changed.

export async function getSiteContent(req, res, next) {
  try {
    const content = await siteContentService.getSiteContent();
    return res.json({ success: true, data: content });
  } catch (error) {
    logError("[api/admin/getSiteContent] Greška", error);
    next(error);
  }
}

function makeSiteContentUpdateHandler(sectionKey, serviceFn, auditAction) {
  return async function updateSiteContentSection(req, res, next) {
    try {
      const updated = await serviceFn(req.body);
      logInfo(`[api/admin/updateSiteContent:${sectionKey}] Sadržaj ažuriran`, { adminId: req.user.id });
      await auditLogService.recordAuditLog({
        ...buildAuditActor(req),
        action: auditAction,
        entity: { type: "SiteContent", id: "singleton" },
        changes: { [sectionKey]: { after: updated } },
      });
      return res.json({ success: true, data: updated });
    } catch (error) {
      logError(`[api/admin/updateSiteContent:${sectionKey}] Greška`, error, { body: req.body });
      next(error);
    }
  };
}

export const updateAbout = makeSiteContentUpdateHandler("about", siteContentService.updateAbout, "SITE_CONTENT_ABOUT_UPDATED");
export const updateFaq = makeSiteContentUpdateHandler("faq", siteContentService.updateFaq, "SITE_CONTENT_FAQ_UPDATED");
export const updatePrivacyPolicy = makeSiteContentUpdateHandler(
  "privacyPolicy",
  siteContentService.updatePrivacyPolicy,
  "SITE_CONTENT_PRIVACY_POLICY_UPDATED"
);
export const updateTermsAndConditions = makeSiteContentUpdateHandler(
  "termsAndConditions",
  siteContentService.updateTermsAndConditions,
  "SITE_CONTENT_TERMS_UPDATED"
);
export const updatePartnership = makeSiteContentUpdateHandler("partnership", siteContentService.updatePartnership, "SITE_CONTENT_PARTNERSHIP_UPDATED");
export const updateHomeIntro = makeSiteContentUpdateHandler("homeIntro", siteContentService.updateHomeIntro, "SITE_CONTENT_HOME_INTRO_UPDATED");
export const updateTeamIntro = makeSiteContentUpdateHandler("teamIntro", siteContentService.updateTeamIntro, "SITE_CONTENT_TEAM_INTRO_UPDATED");

// whyUs's service function takes the array directly (req.body.whyUs), not
// req.body itself, unlike every other section above (whose service functions
// take a {field, field, ...} object matching req.body 1:1) - kept as its own
// small wrapper rather than forcing whyUs into the same {whyUs: [...]}
// envelope shape just to reuse makeSiteContentUpdateHandler.
export async function updateWhyUs(req, res, next) {
  try {
    const updated = await siteContentService.updateWhyUs(req.body.whyUs);
    logInfo("[api/admin/updateSiteContent:whyUs] Sadržaj ažuriran", { adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "SITE_CONTENT_WHY_US_UPDATED",
      entity: { type: "SiteContent", id: "singleton" },
      changes: { whyUs: { after: updated } },
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/updateSiteContent:whyUs] Greška", error, { body: req.body });
    next(error);
  }
}

// ================== Admin's own profile ==================

export async function getProfile(req, res, next) {
  try {
    const user = await userService.findUserProfile(req.user.id);
    return res.json({ success: true, data: user });
  } catch (error) {
    logError("[api/admin/getProfile] Greška", error, { userId: req.user.id });
    next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const updated = await userService.updateProfile(req.user.id, req.body);
    logInfo(`[api/admin/updateProfile] Administrator #${req.user.id} ažurirao profil`, { userId: req.user.id });
    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/updateProfile] Greška", error, { userId: req.user.id, body: req.body });
    next(error);
  }
}

export default {
  dashboard,
  listPayoutRequests, getPayoutRequest, approvePayoutRequest, markPayoutRequestPaid, rejectPayoutRequest, recordPayoutDirectly,
  listAuditLogs,
  getLogDashboard, listLogSummaries, getLogSummary,
  getBusinessReportDashboard, listBusinessReports, getBusinessReport, downloadBusinessReportPdf,
  getSiteSettings, updateSiteSettings, updateWorkingHours, updateClosedDates,
  getSiteContent, updateAbout, updateFaq, updatePrivacyPolicy, updateTermsAndConditions, updatePartnership, updateHomeIntro, updateWhyUs, updateTeamIntro,
  getProfile, updateProfile,
};
