import Redirect from "../models/redirect.model.js";

export async function findBySourcePath(sourcePath, { session } = {}) {
  return Redirect.findOne({ sourcePath, isActive: true }).session(session || null).lean();
}

export async function findAllRedirects({ session } = {}) {
  return Redirect.find({}).sort({ createdAt: -1 }).session(session || null).lean();
}

export async function upsertRedirect({ sourcePath, type, target = null, note = "" }, { session } = {}) {
  return Redirect.findOneAndUpdate(
    { sourcePath },
    { sourcePath, type, target, note, isActive: true },
    { upsert: true, new: true, runValidators: true, session }
  ).lean();
}

export async function deleteBySourcePath(sourcePath, { session } = {}) {
  return Redirect.findOneAndDelete({ sourcePath }, { session }).lean();
}

export default {
  findBySourcePath,
  findAllRedirects,
  upsertRedirect,
  deleteBySourcePath,
};
