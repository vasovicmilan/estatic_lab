import * as newsLetterService from "../../../../services/news-letter.service.js";
import { resolveAdminLimit } from "../../../../utils/pagination.util.js";
import { prepareNewsletterListData, prepareNewsletterDetailsData, SORT_MAP } from "../../../../presenters/admin/marketing/news-letter.presenter.js";
import { resolveAdminSort } from "../../../../utils/admin-list.util.js";
import { logError, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import auditLogService from "../../../../services/audit-log.service.js";

export async function listSubscribers(req, res, next) {
  try {
    const { search, status, page = 1, limit } = req.query;

    const result = await newsLetterService.listSubscribers({
      search: search || "",
      filters: { status: status || undefined },
      page: parseInt(page, 10) || 1,
      limit: resolveAdminLimit(limit),
      sort: resolveAdminSort(req.query, SORT_MAP),
    });

    const viewData = prepareNewsletterListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Newsletter",
      pageDescription: "Pregled svih pretplatnika",
      data: viewData,
    });
  } catch (error) {
    logError("[listSubscribers] Greška pri učitavanju liste pretplatnika", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function subscriberDetails(req, res, next) {
  try {
    const { subscriberId } = req.params;
    const subscriber = await newsLetterService.getSubscriberById(subscriberId);
    const viewData = prepareNewsletterDetailsData(subscriber);

    return res.render("admin/_details", {
      pageTitle: `Pretplatnik - ${subscriber.osnovno.email}`,
      pageDescription: subscriber.osnovno.email,
      data: viewData,
    });
  } catch (error) {
    logError("[subscriberDetails] Greška pri učitavanju detalja pretplatnika", error, {
      subscriberId: req.params.subscriberId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function deleteSubscriber(req, res, next) {
  try {
    const { subscriberId } = req.params;
    await newsLetterService.deleteSubscriberById(subscriberId);
    logInfo(`[deleteSubscriber] Pretplatnik #${subscriberId} obrisan`, { subscriberId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "SUBSCRIBER_DELETED",
      entity: { type: "NewsletterSubscriber", id: subscriberId },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Pretplatnik je uspešno obrisan", "/admin/newsletter");
  } catch (error) {
    logError("[deleteSubscriber] Greška pri brisanju pretplatnika", error, { subscriberId: req.params.subscriberId, userId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "SUBSCRIBER_DELETED",
      entity: { type: "NewsletterSubscriber", id: req.params.subscriberId },
      req,
      success: false,
      errorMessage: error.message,
    });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/admin/newsletter");
    }
    next(error);
  }
}

export default {
  listSubscribers,
  subscriberDetails,
  deleteSubscriber,
};
