import payoutRequestService from "../../../../services/payout-request.service.js";
import {
  preparePayoutRequestListData,
  preparePayoutRequestDetailsData,
} from "../../../../presenters/admin/marketing/payout-request.presenter.js";
import { logError, logInfo, logWarn } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import auditLogService from "../../../../services/audit-log.service.js";

export async function listPayoutRequests(req, res, next) {
  try {
    const { status, earnerType, partnerId, employeeId, page = 1, limit = 10 } = req.query;

    const result = await payoutRequestService.listPayoutRequests({
      filters: {
        status: status || undefined,
        earnerType: earnerType || undefined,
        partner: partnerId || undefined,
        employee: employeeId || undefined,
      },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = preparePayoutRequestListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: "Isplate",
      pageDescription: "Zahtevi za isplatu provizije",
      data: viewData,
    });
  } catch (error) {
    logError("[listPayoutRequests] Greška pri učitavanju liste isplata", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function payoutRequestDetails(req, res, next) {
  try {
    const { requestId } = req.params;
    const request = await payoutRequestService.getPayoutRequestById(requestId);
    const viewData = preparePayoutRequestDetailsData(request);

    return res.render("admin/_details", {
      pageTitle: `Isplata - ${request.earnerName}`,
      pageDescription: request.iznos,
      data: { ...viewData, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[payoutRequestDetails] Greška pri učitavanju detalja isplate", error, {
      requestId: req.params.requestId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function approvePayoutRequest(req, res, next) {
  try {
    const { requestId } = req.params;
    const updated = await payoutRequestService.approvePayoutRequest(requestId, req.body.reason || "");
    logInfo(`[approvePayoutRequest] Zahtev #${requestId} odobren`, { requestId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "PAYOUT_APPROVED",
      entity: { type: "PayoutRequest", id: requestId },
      changes: { status: { old: "requested", new: "approved" } },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Zahtev je odobren", `/admin/isplate/detalji/${requestId}`);
  } catch (error) {
    logError("[approvePayoutRequest] Greška pri odobravanju zahteva", error, { requestId: req.params.requestId, userId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "PAYOUT_APPROVED",
      entity: { type: "PayoutRequest", id: req.params.requestId },
      req,
      success: false,
      errorMessage: error.message,
    });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/isplate/detalji/${req.params.requestId}`);
    }
    next(error);
  }
}

export async function markPayoutRequestPaid(req, res, next) {
  try {
    const { requestId } = req.params;
    const updated = await payoutRequestService.markPayoutRequestPaid(requestId, req.body.reason || "");
    logInfo(`[markPayoutRequestPaid] Zahtev #${requestId} označen kao isplaćen`, { requestId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "PAYOUT_PAID",
      entity: { type: "PayoutRequest", id: requestId },
      changes: { status: { old: null, new: "paid" } },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Isplata je zabeležena", `/admin/isplate/detalji/${requestId}`);
  } catch (error) {
    logError("[markPayoutRequestPaid] Greška pri obeležavanju isplate", error, { requestId: req.params.requestId, userId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "PAYOUT_PAID",
      entity: { type: "PayoutRequest", id: req.params.requestId },
      req,
      success: false,
      errorMessage: error.message,
    });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/isplate/detalji/${req.params.requestId}`);
    }
    next(error);
  }
}

export async function rejectPayoutRequest(req, res, next) {
  try {
    const { requestId } = req.params;
    const updated = await payoutRequestService.rejectPayoutRequest(requestId, req.body.reason || "");
    logInfo(`[rejectPayoutRequest] Zahtev #${requestId} odbijen`, { requestId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "PAYOUT_REJECTED",
      entity: { type: "PayoutRequest", id: requestId },
      changes: { status: { old: null, new: "rejected" } },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Zahtev je odbijen", `/admin/isplate/detalji/${requestId}`);
  } catch (error) {
    logError("[rejectPayoutRequest] Greška pri odbijanju zahteva", error, { requestId: req.params.requestId, userId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "PAYOUT_REJECTED",
      entity: { type: "PayoutRequest", id: req.params.requestId },
      req,
      success: false,
      errorMessage: error.message,
    });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/isplate/detalji/${req.params.requestId}`);
    }
    next(error);
  }
}

// the admin-initiated quick-action: recording a payout that's already happened
// (or is about to) without the earner having requested it first - e.g. admin
// handed over cash in person and just needs it logged. Separate from the
// request/approve/pay flow above, which assumes the earner asked first.
export async function recordPayoutDirectly(req, res, next) {
  const { earnerType, earnerId } = req.body;
  const redirectUrl = earnerType === "employee" ? `/admin/zaposleni/detalji/${earnerId}` : `/admin/partneri/detalji/${earnerId}`;

  try {
    if (req.validationErrors) {
      logWarn("[recordPayoutDirectly] Validacione greške", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), redirectUrl);
    }

    await payoutRequestService.recordPayoutByAdmin(earnerType, earnerId, Number(req.body.amount), req.body.note || "");
    logInfo(`[recordPayoutDirectly] Isplata direktno zabeležena`, { earnerType, earnerId, amount: req.body.amount, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Isplata je zabeležena", redirectUrl);
  } catch (error) {
    logError("[recordPayoutDirectly] Greška pri direktnom beleženju isplate", error, { earnerType, earnerId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, redirectUrl);
    }
    next(error);
  }
}

export default {
  listPayoutRequests,
  payoutRequestDetails,
  approvePayoutRequest,
  markPayoutRequestPaid,
  rejectPayoutRequest,
  recordPayoutDirectly,
};