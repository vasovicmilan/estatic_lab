import WheelPrize from "../models/wheel-prize.model.js";

export async function findAllPrizes({ onlyActive = false } = {}) {
  return WheelPrize.find(onlyActive ? { isActive: true } : {}).sort({ order: 1, createdAt: 1 }).lean();
}

export async function findPrizeById(id) {
  return WheelPrize.findById(id).lean();
}

export async function deletePrizeById(id) {
  return WheelPrize.findByIdAndDelete(id).lean();
}

// exactly one prize may be the fallback - called after another one was made the fallback
export async function unsetFallbackExcept(id) {
  return WheelPrize.updateMany({ _id: { $ne: id }, isFallback: true }, { $set: { isFallback: false } });
}

export async function countPrizes() {
  return WheelPrize.countDocuments({});
}

export async function createPrize(data) {
  const [created] = await WheelPrize.insertMany([data]);
  return created.toObject();
}

export async function createPrizes(prizes) {
  return WheelPrize.insertMany(prizes);
}

export async function updatePrizeById(id, data) {
  return WheelPrize.findByIdAndUpdate(id, data, { returnDocument: "after", runValidators: true }).lean();
}

// Atomic "take one from the stock": succeeds only while the prize is active and has stock
// left (stock null = unlimited), so two simultaneous spins can never both take the last one.
export async function claimPrize(id) {
  return WheelPrize.findOneAndUpdate(
    {
      _id: id,
      isActive: true,
      $or: [{ stock: null }, { $expr: { $lt: ["$awardedCount", "$stock"] } }],
    },
    { $inc: { awardedCount: 1 } },
    { returnDocument: "after" }
  ).lean();
}

// give a claimed prize back when the spin failed after the claim (duplicate lead, coupon error)
export async function releasePrize(id) {
  return WheelPrize.findOneAndUpdate({ _id: id, awardedCount: { $gt: 0 } }, { $inc: { awardedCount: -1 } }, { returnDocument: "after" }).lean();
}

export default { findAllPrizes, findPrizeById, createPrize, deletePrizeById, unsetFallbackExcept, countPrizes, createPrizes, updatePrizeById, claimPrize, releasePrize };
