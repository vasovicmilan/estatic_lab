import ApiToken from "../models/api-token.model.js";
import ApiAccessState from "../models/api-access-state.model.js";

export async function createToken(data) {
  return ApiToken.create(data);
}

export async function findByHash(tokenHash) {
  return ApiToken.findOne({ tokenHash }).lean();
}

export async function findTokenById(id) {
  return ApiToken.findById(id).lean();
}

export async function listTokens() {
  return ApiToken.find({}).sort({ createdAt: -1 }).populate("user", "firstName lastName email").lean();
}

export async function revokeToken(id, revokedBy) {
  return ApiToken.findOneAndUpdate({ _id: id, revokedAt: null }, { $set: { revokedAt: new Date(), revokedBy } }, { new: true }).lean();
}

export async function revokeAllForUser(userId, revokedBy) {
  return ApiToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedBy } });
}

export async function touchToken(id, ip) {
  return ApiToken.updateOne({ _id: id }, { $set: { lastUsedAt: new Date(), lastUsedIp: ip || null } });
}

export async function getAccessState() {
  return ApiAccessState.findOne({ key: "singleton" }).lean();
}

export async function setPaused(paused, userId) {
  return ApiAccessState.findOneAndUpdate(
    { key: "singleton" },
    { $set: { paused, pausedAt: paused ? new Date() : null, pausedBy: paused ? userId : null } },
    { upsert: true, new: true }
  ).lean();
}

export default { createToken, findByHash, findTokenById, listTokens, revokeToken, revokeAllForUser, touchToken, getAccessState, setPaused };
