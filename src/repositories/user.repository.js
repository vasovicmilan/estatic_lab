import User from "../models/user.model.js";
import { buildUserFilter } from "./filters/user.filter.js";
import { resolveLimit, resolveSkip, buildPaginationMeta } from "../utils/pagination.util.js";

function applyPopulate(query, populateFields = []) {
  for (const field of populateFields) {
    query = query.populate(field);
  }
  return query;
}

export async function createUser(data, { session } = {}) {
  const [user] = await User.create([data], { session });
  return user;
}

export async function findUserById(id, { populateFields = [], session } = {}) {
  let query = User.findById(id).session(session || null);
  query = applyPopulate(query, populateFields);
  return query.lean();
}

// password is `select: false` on the schema — only this finder opts back in, so a stray
// findUserById never accidentally leaks a password hash into a mapper/presenter
export async function findUserByEmailWithPassword(email, { populateFields = [], session } = {}) {
  let query = User.findOne({ email: email.toLowerCase().trim() })
    .select("+password")
    .session(session || null);
  for (const field of populateFields) query = query.populate(field);
  return query.lean();
}

export async function findUserByEmail(email, { populateFields = [], session } = {}) {
  let query = User.findOne({ email: email.toLowerCase().trim() }).session(session || null);
  query = applyPopulate(query, populateFields);
  return query.lean();
}

export async function findUserByIdWithPassword(id, { session } = {}) {
  return User.findById(id).select("+password").session(session || null).lean();
}

export async function findUserByGoogleId(googleId, { session } = {}) {
  return User.findOne({ googleId }).session(session || null).lean();
}

export async function findUserByResetToken(token, { session } = {}) {
  return User.findOne({ resetToken: token, resetTokenExpiration: { $gt: new Date() } })
    .select("+password")
    .session(session || null)
    .lean();
}

export async function findUserByConfirmToken(token, { session } = {}) {
  return User.findOne({ confirmToken: token, confirmTokenExpiration: { $gt: new Date() } })
    .session(session || null)
    .lean();
}

// populateFields is applied ONCE, as a single populated query — this is the pattern that
// replaces the manual Promise.all-per-document population loop flagged as an N+1 elsewhere
export async function findUsers({
  search = "",
  limit = 20,
  page = 1,
  filters = {},
  populateFields = [{ path: "role", select: "name permissions" }],
  session,
} = {}) {
  const filter = buildUserFilter({ search, ...filters });
  const resolvedLimit = resolveLimit(limit);
  const skip = resolveSkip(page, resolvedLimit);

  let query = User.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(resolvedLimit)
    .session(session || null);
  query = applyPopulate(query, populateFields);

  const [data, total] = await Promise.all([
    query.lean(),
    User.countDocuments(filter).session(session || null),
  ]);

  return { data, ...buildPaginationMeta({ total, page, limit }) };
}

export async function updateUserById(id, updateData, { session } = {}) {
  return User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true, session }).lean();
}

export async function updateLastLogin(id, { session } = {}) {
  return User.findByIdAndUpdate(id, { lastLogin: new Date() }, { new: true, session }).lean();
}

export async function deleteUserById(id, { session } = {}) {
  return User.findByIdAndDelete(id, { session }).lean();
}

export async function countUsers(filters = {}, { session } = {}) {
  return User.countDocuments(buildUserFilter(filters)).session(session || null);
}
