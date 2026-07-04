import * as newsLetterService from "../../../../services/news-letter.service.js";
import { prepareNewsletterListData, prepareNewsletterDetailsData } from "../../../../presenters/admin/marketing/news-letter.presenter.js";
import { logError, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

export async function listSubscribers(req, res, next) {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;

    const result = await newsLetterService.listSubscribers({
      search: search || "",
      filters: { status: status || undefined },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
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
      pageTitle: `Pretplatnik — ${subscriber.osnovno.email}`,
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
    return flashAndRedirect(req, res, "success", "Pretplatnik je uspešno obrisan", "/admin/newsletter");
  } catch (error) {
    logError("[deleteSubscriber] Greška pri brisanju pretplatnika", error, { subscriberId: req.params.subscriberId, userId: req.session?.user?.id });
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
