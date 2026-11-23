import Wheel from "../models/wheel.model.js";

export async function findAllWheels() {
  return Wheel.find({}).sort({ order: 1, createdAt: 1 }).lean();
}

export async function findWheelBySlug(slug) {
  return Wheel.findOne({ slug }).lean();
}

export async function findWheelById(id) {
  return Wheel.findById(id).lean();
}

export async function countWheels() {
  return Wheel.countDocuments({});
}

export async function createWheel(data) {
  const [created] = await Wheel.insertMany([data]);
  return created.toObject();
}

export async function updateWheelById(id, data) {
  return Wheel.findByIdAndUpdate(id, data, { returnDocument: "after", runValidators: true }).lean();
}

export async function deleteWheelById(id) {
  return Wheel.findByIdAndDelete(id).lean();
}

export default { findAllWheels, findWheelBySlug, findWheelById, countWheels, createWheel, updateWheelById, deleteWheelById };
