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
import { logError, logInfo } from "../../../utils/logger.util.js";
import { getStartOfDayInZone, getEndOfDayInZone } from "../../../utils/date.time.util.js";
import { resolvePage, resolveLimit, pickPaginationMeta } from "../../../utils/pagination.util.js";
import { buildAuditActor } from "../../../utils/audit-actor.util.js";

// Mirrors controllers/web/admin/{dashboard,marketing/payout-request,logs/*,
// reports/business-report,marketing/site-settings,profile}.controller.js - same
// services, same audit log entries. Returns the raw service data (counts, lists)
// rather than routing it through the HTML presenters (prepareDashboardData etc.) -
// those add icons/labels/HTML-table shape a JSON client has no use for. PDF
// download (businessReportDownloadPdf) is deliberately not exposed here - it's a
// binary file response, not a JSON endpoint; same reasoning as image upload being
// out of scope elsewhere in this API.

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

export async function listPayoutRequests(req, res, next) {
  try {
    const { status, earnerType, partnerId, employeeId, page = 1, limit = 10 } = req.query;
    const result = await payoutRequestService.listPayoutRequests({
      filters: { status: status || undefined, earnerType: earnerType || undefined, partner: partnerId || undefined, employee: employeeId || undefined },
      page: resolvePage(page),
      limit: resolveLimit(limit),
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

export async function listLogSummaries(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await logReportService.listLogSummaries({ page: resolvePage(page), limit: resolveLimit(limit) });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listLogSummaries] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getLogSummary(req, res, next) {
  try {
    const summary = await logReportService.getLogSummaryByDate(req.params.date);
    if (!summary) return res.status(404).json({ success: false, error: { message: `Nema sačuvanog izveštaja za ${req.params.date}` } });
    return res.json({ success: true, data: summary });
  } catch (error) {
    logError("[api/admin/getLogSummary] Greška", error, { date: req.params.date });
    next(error);
  }
}

// ================== Business reports ==================

const REPORT_PERIOD_TYPES = ["daily", "weekly", "monthly", "quarterly", "yearly"];

export async function getBusinessReportDashboard(req, res, next) {
  try {
    const entries = await Promise.all(REPORT_PERIOD_TYPES.map(async (periodType) => [periodType, await businessReportService.getCurrentPeriodSummaryLive(periodType)]));
    return res.json({ success: true, data: Object.fromEntries(entries) });
  } catch (error) {
    logError("[api/admin/getBusinessReportDashboard] Greška", error);
    next(error);
  }
}

export async function listBusinessReports(req, res, next) {
  try {
    const { periodType } = req.params;
    if (!REPORT_PERIOD_TYPES.includes(periodType)) return res.status(400).json({ success: false, error: { message: "Nepoznat tip perioda" } });

    const { page = 1, limit = 20 } = req.query;
    const result = await businessReportService.listSummaries(periodType, { page: resolvePage(page), limit: resolveLimit(limit) });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listBusinessReports] Greška", error, { periodType: req.params.periodType, query: req.query });
    next(error);
  }
}

export async function getBusinessReport(req, res, next) {
  try {
    const { periodType, periodKey } = req.params;
    if (!REPORT_PERIOD_TYPES.includes(periodType)) return res.status(400).json({ success: false, error: { message: "Nepoznat tip perioda" } });

    const summary = await businessReportService.getSummary(periodType, periodKey);
    if (!summary) return res.status(404).json({ success: false, error: { message: `Nema sačuvanog izveštaja za ${periodKey}` } });
    return res.json({ success: true, data: summary });
  } catch (error) {
    logError("[api/admin/getBusinessReport] Greška", error, { periodType: req.params.periodType, periodKey: req.params.periodKey });
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
  getBusinessReportDashboard, listBusinessReports, getBusinessReport,
  getSiteSettings, updateSiteSettings,
  getProfile, updateProfile,
};
