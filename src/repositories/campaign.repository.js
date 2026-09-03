import Campaign from "../models/campaign.model.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

export async function createCampaign(data, { session } = {}) {
  const [campaign] = await Campaign.create([data], { session });
  return campaign;
}

export async function findCampaignById(id, { session } = {}) {
  return Campaign.findById(id).session(session || null).lean();
}

// Returns the live Mongoose document (not .lean()) - callers that need to
// .save() it (sendCampaignNow, the scheduled cron sweep) go through this one,
// the same split post.repository.js draws between findPostById and
// findDueScheduledPosts.
export async function findCampaignDocById(id, { session } = {}) {
  return Campaign.findById(id).session(session || null);
}

export async function findCampaigns({ search = "", limit = 20, page = 1, filters = {}, session } = {}) {
  const filter = { ...filters };
  if (search) filter.$or = [{ title: { $regex: search, $options: "i" } }, { subject: { $regex: search, $options: "i" } }];

  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  const [data, total] = await Promise.all([
    Campaign.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(resolvedLimit).session(session || null).lean(),
    Campaign.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export async function findDueScheduledCampaigns({ session } = {}) {
  return Campaign.find({ status: "scheduled", scheduledFor: { $lte: new Date() } }).session(session || null);
}

export async function updateCampaignById(id, updateData, { session } = {}) {
  return Campaign.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function deleteCampaignById(id, { session } = {}) {
  return Campaign.findByIdAndDelete(id, { session }).lean();
}

export async function countCampaigns(filters = {}, { session } = {}) {
  return Campaign.countDocuments(filters).session(session || null);
}

export default {
  createCampaign,
  findCampaignById,
  findCampaignDocById,
  findCampaigns,
  findDueScheduledCampaigns,
  updateCampaignById,
  deleteCampaignById,
  countCampaigns,
};
