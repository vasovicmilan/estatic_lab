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

// password is `select: false` on the schema - only this finder opts back in, so a stray
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

// populateFields is applied ONCE, as a single populated query - this is the pattern that
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
    .sort({ createdAt: -1, _id: -1 })
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
  return User.findByIdAndUpdate(id, updateData, { returnDocument: "after", runValidators: true, session }).lean();
}

export async function updateLastLogin(id, { session } = {}) {
  return User.findByIdAndUpdate(id, { lastLogin: new Date() }, { returnDocument: "after", session }).lean();
}

export async function deleteUserById(id, { session } = {}) {
  return User.findByIdAndDelete(id, { session }).lean();
}

export async function countUsers(filters = {}, { session } = {}) {
  return User.countDocuments(buildUserFilter(filters)).session(session || null);
}

// ==================== CART ====================
// {product, variant, quantity} lines only - see cart-item.schema.js. No snapshot
// fields here, so nothing to keep in sync when a product's price or title changes.

export async function incrementCartItemQuantity(userId, product, variant, amount, { session } = {}) {
  return User.findOneAndUpdate(
    { _id: userId, cart: { $elemMatch: { product, variant } } },
    { $inc: { "cart.$[elem].quantity": amount } },
    { arrayFilters: [{ "elem.product": product, "elem.variant": variant }], returnDocument: "after", session }
  ).lean();
}

export async function addCartItem(userId, { product, variant = null, quantity = 1 }, { session } = {}) {
  return User.findByIdAndUpdate(
    userId,
    { $push: { cart: { product, variant, quantity } } },
    { returnDocument: "after", session }
  ).lean();
}

export async function setCartItemQuantity(userId, cartItemId, quantity, { session } = {}) {
  return User.findOneAndUpdate(
    { _id: userId, "cart._id": cartItemId },
    { $set: { "cart.$.quantity": quantity } },
    { returnDocument: "after", session }
  ).lean();
}

export async function removeCartItem(userId, cartItemId, { session } = {}) {
  return User.findByIdAndUpdate(
    userId,
    { $pull: { cart: { _id: cartItemId } } },
    { returnDocument: "after", session }
  ).lean();
}

export async function clearCart(userId, { session } = {}) {
  return User.findByIdAndUpdate(userId, { $set: { cart: [] } }, { returnDocument: "after", session }).lean();
}

// used when merging a guest session cart into a just-logged-in user's own cart -
// the merge/dedup arithmetic (matching lines by product+variant, summing quantities)
// belongs in the service layer; this just persists whatever final array it computed
export async function replaceCart(userId, cartItems, { session } = {}) {
  return User.findByIdAndUpdate(userId, { $set: { cart: cartItems } }, { returnDocument: "after", session }).lean();
}

// ==================== ADDRESSES ====================

export async function addAddressToUser(userId, addressRecord, { session } = {}) {
  return User.findByIdAndUpdate(
    userId,
    { $push: { addresses: addressRecord } },
    { returnDocument: "after", session }
  ).lean();
}

export async function removeAddressFromUser(userId, addressId, { session } = {}) {
  return User.findByIdAndUpdate(
    userId,
    { $pull: { addresses: { _id: addressId } } },
    { returnDocument: "after", session }
  ).lean();
}

// Two separate writes, not atomic across both - acceptable here since this is a
// low-contention, single-user-initiated action, same tradeoff already made for
// other admin-side multi-step mutations in this codebase.
export async function setDefaultAddress(userId, addressId, { session } = {}) {
  await User.updateOne({ _id: userId }, { $set: { "addresses.$[].isDefault": false } }, { session });
  return User.findOneAndUpdate(
    { _id: userId, "addresses._id": addressId },
    { $set: { "addresses.$.isDefault": true } },
    { returnDocument: "after", session }
  ).lean();
}

// Projects only `cart` instead of the full document - this runs on every page load
// (see locals.config.js's nav cart-count badge), so it stays as cheap as possible
// rather than reusing the full findUserById + populate path getCart() uses.
export async function findUserCartQuantities(userId, { session } = {}) {
  return User.findById(userId).select("cart").session(session || null).lean();
}

export default {
  createUser,
  findUserById,
  findUserByEmailWithPassword,
  findUserByEmail,
  findUserByIdWithPassword,
  findUserByGoogleId,
  findUserByResetToken,
  findUserByConfirmToken,
  findUsers,
  updateUserById,
  updateLastLogin,
  deleteUserById,
  countUsers,
  incrementCartItemQuantity,
  addCartItem,
  setCartItemQuantity,
  removeCartItem,
  clearCart,
  replaceCart,
  addAddressToUser,
  removeAddressFromUser,
  setDefaultAddress,
  findUserCartQuantities,
}