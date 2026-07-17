import NewsLetter from "../models/news-letter.model.js";
import { buildNewsLetterFilter } from "./filters/news-letter.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createSubscriber(data, { session } = {}) {
  const [subscriber] = await NewsLetter.create([data], { session });
  return subscriber;
}

export async function findSubscriberById(id, { session } = {}) {
  return NewsLetter.findById(id).session(session || null).lean();
}

export async function findSubscriberByEmail(email, { session } = {}) {
  return NewsLetter.findOne({ email: email.toLowerCase().trim() }).session(session || null).lean();
}

export async function findSubscriberByUnsubscribeToken(token, { session } = {}) {
  return NewsLetter.findOne({ unsubscribeToken: token }).session(session || null).lean();
}

export async function findSubscribers({ search = "", limit = 20, page = 1, filters = {}, session } = {}) {
  const filter = buildNewsLetterFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  const [data, total] = await Promise.all([
    NewsLetter.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(resolvedLimit)
      .session(session || null)
      .lean(),
    NewsLetter.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

// unpaginated - used by the campaign-send job to fetch every active recipient
export async function findAllActiveSubscribers({ session } = {}) {
  return NewsLetter.find({ status: "subscribed" }).session(session || null).lean();
}

export async function updateSubscriberById(id, updateData, { session } = {}) {
  return NewsLetter.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function deleteSubscriberById(id, { session } = {}) {
  return NewsLetter.findByIdAndDelete(id, { session }).lean();
}

export async function countSubscribers(filters = {}, { session } = {}) {
  return NewsLetter.countDocuments(buildNewsLetterFilter(filters)).session(session || null);
}

export default {
  createSubscriber,
  findSubscriberById,
  findSubscriberByEmail,
  findSubscriberByUnsubscribeToken,
  findSubscribers,
  findAllActiveSubscribers,
  updateSubscriberById,
  deleteSubscriberById,
  countSubscribers,
}