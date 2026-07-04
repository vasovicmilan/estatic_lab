import eventEmitter from "../events/event.emitter.js";
import newsLetterRepo from "../repositories/news-letter.repository.js";
import { mapSubscribersForAdminList, mapSubscriberForAdminDetail } from "../mappers/news-letter.mapper.js";
import { generateRandomToken } from "./crypto.service.js";
import { validationError, notFound, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

export async function listSubscribers({ search = "", filters = {}, limit = 10, page = 1 } = {}) {
  const result = await newsLetterRepo.findSubscribers({ search, limit, page, filters });
  return { data: mapSubscribersForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getSubscriberById(subscriberId) {
  if (!subscriberId) validationError("subscriberId");
  const subscriber = await newsLetterRepo.findSubscriberById(subscriberId);
  if (!subscriber) notFound("Pretplatnik");
  return mapSubscriberForAdminDetail(subscriber);
}

export async function subscribe(email) {
  if (!email) validationError("email");

  const existing = await newsLetterRepo.findSubscriberByEmail(email);
  if (existing) {
    if (existing.status === "subscribed") {
      return { message: "Već ste prijavljeni na naš newsletter" };
    }
    await newsLetterRepo.updateSubscriberById(existing._id, { status: "subscribed", unsubscribedAt: null, subscribedAt: new Date() });
    logInfo("Newsletter re-subscribed", { email });
    return { message: "Uspešno ste se ponovo prijavili na newsletter" };
  }

  const unsubscribeToken = generateRandomToken();
  const created = await newsLetterRepo.createSubscriber({ email: email.toLowerCase().trim(), unsubscribeToken });

  logInfo("Newsletter subscribed", { email: created.email });
  eventEmitter.emit("newsletter:subscribed", { email: created.email, unsubscribeToken });

  return { message: "Uspešno ste se prijavili na newsletter" };
}

export async function unsubscribe(token) {
  if (!token) validationError("token");
  const subscriber = await newsLetterRepo.findSubscriberByUnsubscribeToken(token);
  if (!subscriber) badRequest("Nevažeći link za odjavu");

  await newsLetterRepo.updateSubscriberById(subscriber._id, { status: "unsubscribed", unsubscribedAt: new Date() });
  logInfo("Newsletter unsubscribed", { email: subscriber.email });
  return { message: "Uspešno ste se odjavili sa newsletter-a" };
}

export async function deleteSubscriberById(subscriberId) {
  if (!subscriberId) validationError("subscriberId");
  const existing = await newsLetterRepo.findSubscriberById(subscriberId);
  if (!existing) notFound("Pretplatnik");
  await newsLetterRepo.deleteSubscriberById(subscriberId);
  logInfo("Subscriber deleted", { subscriberId });
  return { success: true };
}

export default {
  listSubscribers,
  getSubscriberById,
  subscribe,
  unsubscribe,
  deleteSubscriberById,
};
