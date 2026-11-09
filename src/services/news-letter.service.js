import eventEmitter from "../events/event.emitter.js";
import newsLetterRepo from "../repositories/news-letter.repository.js";
import { mapSubscribersForAdminList, mapSubscriberForAdminDetail } from "../mappers/news-letter.mapper.js";
import { generateRandomToken } from "./crypto.service.js";
import { validationError, notFound, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";
import { NEWSLETTER_SOURCES } from "../models/news-letter.model.js";

export async function listSubscribers({ search = "", filters = {}, limit = 10, page = 1, sort } = {}) {
  const result = await newsLetterRepo.findSubscribers({ search, limit, page, filters, sort });
  return { data: mapSubscribersForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getSubscriberById(subscriberId) {
  if (!subscriberId) validationError("subscriberId");
  const subscriber = await newsLetterRepo.findSubscriberById(subscriberId);
  if (!subscriber) notFound("Pretplatnik");
  return mapSubscriberForAdminDetail(subscriber);
}

function cleanSourceDetail(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, 120);
  return trimmed || null;
}

// `origin` records which part of the system the signup came from. It is written once, on the
// first opt-in (or filled in later for a legacy address whose source is still "unknown") -
// a later signup through another door doesn't overwrite where the person first came from.
export async function subscribe(email, interests = ["general"], origin = {}) {
  if (!email) validationError("email");
  const cleanInterests = interests.length ? interests : ["general"];
  const source = NEWSLETTER_SOURCES.includes(origin.source) ? origin.source : "unknown";
  const sourceDetail = cleanSourceDetail(origin.sourceDetail);

  const existing = await newsLetterRepo.findSubscriberByEmail(email);
  if (existing) {
    // merge, don't overwrite - re-subscribing to add "products" shouldn't
    // silently drop an existing "partnership" opt-in
    const mergedInterests = Array.from(new Set([...(existing.interests || []), ...cleanInterests]));
    const originPatch = !existing.source || existing.source === "unknown" ? { source, sourceDetail } : {};
    if (existing.status === "subscribed") {
      await newsLetterRepo.updateSubscriberById(existing._id, { interests: mergedInterests, ...originPatch });
      return { message: "Već ste prijavljeni na naš newsletter" };
    }
    await newsLetterRepo.updateSubscriberById(existing._id, {
      status: "subscribed",
      unsubscribedAt: null,
      subscribedAt: new Date(),
      interests: mergedInterests,
      ...originPatch,
    });
    logInfo("Newsletter re-subscribed", { email });
    return { message: "Uspešno ste se ponovo prijavili na newsletter" };
  }

  const unsubscribeToken = generateRandomToken();
  const created = await newsLetterRepo.createSubscriber({
    email: email.toLowerCase().trim(),
    unsubscribeToken,
    interests: cleanInterests,
    source,
    sourceDetail,
    consentedAt: new Date(),
  });

  logInfo("Newsletter subscribed", { email: created.email, interests: cleanInterests });
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
