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

// Atomic claim step for jobs/campaign-jobs.js's cron sweep - the filter repeats
// findDueScheduledCampaigns' own condition (status still "scheduled" AND still
// due) alongside the _id, so the flip to "sending" only happens if nothing else
// has already claimed (or the admin hasn't unscheduled/edited) this campaign
// since the read. Same "findOneAndUpdate with a status filter" pattern as
// payout-request.repository.js's updatePayoutRequestStatusAtomic: Mongo
// serializes concurrent writes to the same document, so if this tick's sweep
// overlaps a previous tick's still-in-flight send, only one findOneAndUpdate
// call actually matches and flips status - the other gets null back and the
// caller must treat that as "someone else already has this one", never send
// again.
export async function claimDueCampaignForSending(id, { session } = {}) {
  return Campaign.findOneAndUpdate(
    { _id: id, status: "scheduled", scheduledFor: { $lte: new Date() } },
    { $set: { status: "sending" } },
    { new: true, runValidators: true, session }
  );
}

// Failure escape hatch for a campaign claimed above whose actual send then threw
// (e.g. the mail provider is down) - moves it OUT of "sending" so it can't stay
// stuck there forever, but deliberately NOT back to "scheduled", since
// findDueScheduledCampaigns only matches "scheduled" and would otherwise pick it
// straight back up next tick and retry (and re-send to whichever subscribers a
// partial failure already reached) forever. An admin has to look at a "failed"
// campaign and decide to reschedule it.
export async function markCampaignSendFailed(id, { session } = {}) {
  return Campaign.findOneAndUpdate({ _id: id, status: "sending" }, { $set: { status: "failed" } }, { new: true, session }).lean();
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
  claimDueCampaignForSending,
  markCampaignSendFailed,
  updateCampaignById,
  deleteCampaignById,
  countCampaigns,
};
