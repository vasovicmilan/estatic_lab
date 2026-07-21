import payoutRequestService from "../../../../services/payout-request.service.js";
import {
  preparePayoutRequestListData,
  preparePayoutRequestDetailsData,
} from "../../../../presenters/admin/marketing/payout-request.presenter.js";
import { logError, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

export async function listPayoutRequests(req, res, next) {
  try {
    const { status, earnerType, page = 1, limit = 10 } = req.query;

    const result = await payoutRequestService.listPayoutRequests({
      filters: { status: status || undefined, earnerType: earnerType || undefined },
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
    await payoutRequestService.approvePayoutRequest(requestId, req.body.reason || "");
    logInfo(`[approvePayoutRequest] Zahtev #${requestId} odobren`, { requestId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Zahtev je odobren", `/admin/isplate/detalji/${requestId}`);
  } catch (error) {
    logError("[approvePayoutRequest] Greška pri odobravanju zahteva", error, { requestId: req.params.requestId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/isplate/detalji/${req.params.requestId}`);
    }
    next(error);
  }
}

export async function markPayoutRequestPaid(req, res, next) {
  try {
    const { requestId } = req.params;
    await payoutRequestService.markPayoutRequestPaid(requestId, req.body.reason || "");
    logInfo(`[markPayoutRequestPaid] Zahtev #${requestId} označen kao isplaćen`, { requestId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Isplata je zabeležena", `/admin/isplate/detalji/${requestId}`);
  } catch (error) {
    logError("[markPayoutRequestPaid] Greška pri obeležavanju isplate", error, { requestId: req.params.requestId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/isplate/detalji/${req.params.requestId}`);
    }
    next(error);
  }
}

export async function rejectPayoutRequest(req, res, next) {
  try {
    const { requestId } = req.params;
    await payoutRequestService.rejectPayoutRequest(requestId, req.body.reason || "");
    logInfo(`[rejectPayoutRequest] Zahtev #${requestId} odbijen`, { requestId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Zahtev je odbijen", `/admin/isplate/detalji/${requestId}`);
  } catch (error) {
    logError("[rejectPayoutRequest] Greška pri odbijanju zahteva", error, { requestId: req.params.requestId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/isplate/detalji/${req.params.requestId}`);
    }
    next(error);
  }
}

export default { listPayoutRequests, payoutRequestDetails, approvePayoutRequest, markPayoutRequestPaid, rejectPayoutRequest };