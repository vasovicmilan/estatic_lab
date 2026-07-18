import userRepo from "../repositories/user.repository.js";
import roleService from "./role.service.js";
import productService from "./product.service.js";
import { mapUser, mapUsersForAdminList, mapUserForAdminDetail, mapUserForProfile, mapUserAddresses, mapUserCart } from "../mappers/user.mapper.js";
import { hashPassword, comparePasswords, generateRandomToken, encrypt, sha256 } from "./crypto.service.js";
import { validationError, notFound, conflict, unauthorized, badRequest } from "../utils/error.util.js";
import { logInfo, logError } from "../utils/logger.util.js";
import { buildPhoneRecord } from "../utils/phone.util.js";
import { buildAddressRecord } from "../utils/address.util.js";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h
const CONFIRM_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function validateRegistrationData(data) {
  if (!data) validationError("data");
  if (!data.email) validationError("email");
  if (!data.password) validationError("password");
  if (!data.firstName) validationError("firstName");
  if (!data.lastName) validationError("lastName");
  if (data.password !== (data.passwordConfirm || data.confirmedPassword)) {
    badRequest("Lozinke se ne poklapaju");
  }
  if (data.password.length < 8) {
    badRequest("Lozinka mora imati najmanje 8 karaktera");
  }
}

export async function listUsers({ search = "", status, role, provider, excludeUserId = null, limit = 10, page = 1 } = {}) {
  const result = await userRepo.findUsers({
    search,
    limit,
    page,
    filters: { status, role, provider, excludeId: excludeUserId },
    populateFields: [{ path: "role", select: "name permissions" }],
  });
  return { data: mapUsersForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getUserById(userId) {
  if (!userId) validationError("userId");
  const user = await userRepo.findUserById(userId, { populateFields: [{ path: "role", select: "name permissions" }] });
  if (!user) notFound("Korisnik");
  return mapUserForAdminDetail(user);
}

export async function findUserProfile(userId) {
  if (!userId) validationError("userId");
  const user = await userRepo.findUserById(userId, { populateFields: [{ path: "role", select: "name" }] });
  if (!user) notFound("Korisnik");
  return mapUserForProfile(user);
}

export async function findUserByEmail(email) {
  if (!email) return null;
  return userRepo.findUserByEmail(email, { populateFields: [{ path: "role", select: "name permissions" }] });
}

export async function findUserForLogin(email) {
  if (!email) validationError("email");
  return userRepo.findUserByEmailWithPassword(email, { populateFields: [{ path: "role", select: "name permissions" }] });
}

async function resolveRegistrationRole() {
  const userCount = await userRepo.countUsers();
  const isFirstUser = userCount === 0;

  if (isFirstUser) {
    const adminRole = await roleService.findRoleByName("admin");
    if (!adminRole) badRequest("Rola 'admin' nije konfigurisana - pokrenite seed rola pre registracije");
    return { role: adminRole, isFirstUser: true };
  }

  const userRole = await roleService.findRoleByName("user");
  if (!userRole) badRequest("Podrazumevana rola za korisnike nije konfigurisana");
  return { role: userRole, isFirstUser: false };
}

export async function registerUser(data) {
  validateRegistrationData(data);

  const existing = await userRepo.findUserByEmail(data.email);
  if (existing) conflict("Nalog sa ovim email-om već postoji");

  const { role, isFirstUser } = await resolveRegistrationRole();

  const passwordHash = await hashPassword(data.password);
  const confirmToken = generateRandomToken();

  const created = await userRepo.createUser({
    email: data.email.toLowerCase().trim(),
    password: passwordHash,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: buildPhoneRecord(data.phone),
    role: role._id,
    provider: "local",
    // the first user has no one to send/click a confirmation link, so skip straight to active
    status: isFirstUser ? "active" : "pending",
    confirmed: isFirstUser,
    confirmToken: isFirstUser ? null : confirmToken,
    confirmTokenExpiration: isFirstUser ? null : new Date(Date.now() + CONFIRM_TOKEN_TTL_MS),
  });

  logInfo("User registered", { userId: created._id, email: created.email, isFirstUser, roleName: role.name });

  return { id: created._id.toString(), email: created.email, firstName: created.firstName, lastName: created.lastName, confirmToken: isFirstUser ? null : confirmToken, isFirstUser };
}

export async function findOrCreateGoogleUser(googleData) {
  if (!googleData?.email) validationError("email");
  if (!googleData?.googleId) validationError("googleId");

  let user = await userRepo.findUserByGoogleId(googleData.googleId);
  if (user) return user;

  // an account may already exist locally under the same email - link the Google id
  // instead of creating a duplicate account
  user = await userRepo.findUserByEmail(googleData.email);
  if (user) {
    return userRepo.updateUserById(user._id, {
      googleId: googleData.googleId,
      avatar: user.avatar || googleData.avatar || "",
    });
  }

  const { role, isFirstUser } = await resolveRegistrationRole();

  const created = await userRepo.createUser({
    email: googleData.email.toLowerCase().trim(),
    firstName: googleData.firstName || "Korisnik",
    lastName: googleData.lastName || "",
    googleId: googleData.googleId,
    avatar: googleData.avatar || "",
    provider: "google",
    role: role._id,
    status: "active",
    confirmed: true,
  });

  if (isFirstUser) {
    logInfo("First user registered via Google - auto-promoted to admin", { userId: created._id, email: created.email });
  }

  logInfo("User registered via Google", { userId: created._id, email: created.email });
  return created;
}

/**
 * Core of the guest-booking flow (see appointment.service.js). Looked up BEFORE the
 * booking transaction starts (read-only); if no account exists, the caller creates one
 * INSIDE the same transaction as the appointment write, passing the session through here.
 * `status: "guest"` + resetToken doubles as the "claim your account" link - same email
 * flow as a normal password reset.
 */
export async function createGuestUser({ firstName, lastName, email, phone }, { session } = {}) {
  if (!email) validationError("email");
  if (!firstName) validationError("firstName");

  const role = await roleService.findRoleByName("user");
  if (!role) badRequest("Podrazumevana rola za korisnike nije konfigurisana");

  const resetToken = generateRandomToken();

  const created = await userRepo.createUser(
    {
      email: email.toLowerCase().trim(),
      firstName,
      lastName: lastName || "",
      phone: buildPhoneRecord(phone),
      role: role._id,
      provider: "local",
      status: "guest",
      confirmed: false,
      resetToken,
      resetTokenExpiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days to claim
    },
    { session }
  );

  return created;
}

export async function confirmAccount(token) {
  if (!token) validationError("token");
  const user = await userRepo.findUserByConfirmToken(token);
  if (!user) badRequest("Link za potvrdu naloga je nevažeći ili istekao");

  await userRepo.updateUserById(user._id, {
    confirmed: true,
    status: "active",
    confirmToken: null,
    confirmTokenExpiration: null,
  });

  logInfo("Account confirmed", { userId: user._id, email: user.email });
  return { email: user.email, firstName: user.firstName };
}

export async function setPasswordResetToken(userId) {
  if (!userId) validationError("userId");
  const token = generateRandomToken();
  await userRepo.updateUserById(userId, {
    resetToken: token,
    resetTokenExpiration: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });
  return { token };
}

export async function resetPassword(token, newPassword) {
  if (!token) validationError("token");
  if (!newPassword) validationError("newPassword");
  if (newPassword.length < 8) badRequest("Lozinka mora imati najmanje 8 karaktera");

  const user = await userRepo.findUserByResetToken(token);
  if (!user) badRequest("Link za reset lozinke je nevažeći ili istekao");

  const passwordHash = await hashPassword(newPassword);
  const wasGuest = user.status === "guest";

  await userRepo.updateUserById(user._id, {
    password: passwordHash,
    resetToken: null,
    resetTokenExpiration: null,
    // claiming a guest account also confirms it, since they proved control of the inbox
    ...(wasGuest ? { status: "active", confirmed: true } : {}),
  });

  logInfo("Password reset", { userId: user._id, wasGuest });
  return { email: user.email, firstName: user.firstName };
}

export async function changePassword(userId, oldPassword, newPassword) {
  if (!userId) validationError("userId");
  if (!oldPassword) validationError("oldPassword");
  if (!newPassword) validationError("newPassword");
  if (newPassword.length < 8) badRequest("Lozinka mora imati najmanje 8 karaktera");

  const user = await userRepo.findUserByIdWithPassword(userId);
  if (!user) notFound("Korisnik");
  if (!user.password) badRequest("Nalog nema podešenu lozinku (prijavljeni ste preko Google-a)");

  const isValid = await comparePasswords(oldPassword, user.password);
  if (!isValid) unauthorized("Trenutna lozinka nije ispravna");

  const passwordHash = await hashPassword(newPassword);
  await userRepo.updateUserById(userId, { password: passwordHash });

  logInfo("Password changed", { userId });
  return { email: user.email, firstName: user.firstName };
}

export async function deactivateAccount(userId, password) {
  if (!userId) validationError("userId");
  const user = await userRepo.findUserByIdWithPassword(userId);
  if (!user) notFound("Korisnik");

  if (user.password) {
    if (!password) validationError("password");
    const isValid = await comparePasswords(password, user.password);
    if (!isValid) unauthorized("Lozinka nije ispravna");
  }

  await userRepo.updateUserById(userId, { status: "inactive" });
  logInfo("Account deactivated", { userId });
  return { email: user.email, firstName: user.firstName };
}

export async function updateProfile(userId, data) {
  if (!userId) validationError("userId");
  const allowed = { firstName: data.firstName, lastName: data.lastName };
  if (data.phone !== undefined) {
    allowed.phone = buildPhoneRecord(data.phone);
  }
  const updated = await userRepo.updateUserById(userId, allowed);
  if (!updated) notFound("Korisnik");
  return mapUserForProfile(updated);
}

export async function updateUserStatus(userId, status) {
  if (!userId) validationError("userId");
  if (!status) validationError("status");
  const updated = await userRepo.updateUserById(userId, { status });
  if (!updated) notFound("Korisnik");
  logInfo("User status changed", { userId, status });
  return mapUserForAdminDetail(updated);
}

export async function updateUserRole(userId, roleId) {
  if (!userId) validationError("userId");
  if (!roleId) validationError("roleId");
  const updated = await userRepo.updateUserById(userId, { role: roleId });
  if (!updated) notFound("Korisnik");
  logInfo("User role changed", { userId, roleId });
  return mapUserForAdminDetail(updated);
}

export async function updateLastLogin(userId) {
  return userRepo.updateLastLogin(userId);
}

export async function verifyUserByAdmin(userId) {
  if (!userId) validationError("userId");
  const updated = await userRepo.updateUserById(userId, { confirmed: true, status: "active", confirmToken: null });
  if (!updated) notFound("Korisnik");
  return mapUserForAdminDetail(updated);
}

export async function findUserById(userId) {
  if (!userId) return null;
  return userRepo.findUserById(userId, { populateFields: [{ path: "role", select: "name" }] });
}

export async function deleteUser(userId) {
  if (!userId) validationError("userId");
  const existing = await userRepo.findUserById(userId);
  if (!existing) notFound("Korisnik");
  await userRepo.deleteUserById(userId);
  logInfo("User deleted", { userId });
  return { success: true };
}

// ==================== CART ====================
// Cart lines are deliberately NOT a stock reservation - stock is only actually
// reserved at checkout (see temporary-order.service.js). Adding to cart just checks
// the variant currently exists and is active; a soft "prekoracenje" flag (see
// mapUserCart) tells the UI when a line now exceeds available stock, but nothing
// here blocks it - the authoritative check happens once, at checkout.

const CART_PRODUCT_POPULATE = [{ path: "cart.product", select: "name slug sku image isActive variations" }];

export async function getCart(userId) {
  if (!userId) validationError("userId");
  const user = await userRepo.findUserById(userId, { populateFields: CART_PRODUCT_POPULATE });
  if (!user) notFound("Korisnik");
  return mapUserCart(user);
}

// Cheap total-item-count for the nav cart badge - no product population, just sums
// quantities from the raw cart array. Never throws on a missing user (returns 0
// instead) since this runs on every page load via locals.config.js, not from a
// request a user can retry.
export async function getCartItemCount(userId) {
  if (!userId) return 0;
  const user = await userRepo.findUserCartQuantities(userId);
  if (!user) return 0;
  return (user.cart || []).reduce((sum, line) => sum + (line.quantity || 0), 0);
}

export async function addToCart(userId, { productId, variantId, quantity = 1 }) {
  if (!userId) validationError("userId");
  if (!productId) validationError("productId");
  if (!variantId) validationError("variantId");
  if (!quantity || quantity <= 0) validationError("quantity");

  // throws if the variant doesn't exist or isn't active
  await productService.getVariationRaw(productId, variantId);

  const incremented = await userRepo.incrementCartItemQuantity(userId, productId, variantId, quantity);
  if (!incremented) {
    await userRepo.addCartItem(userId, { product: productId, variant: variantId, quantity });
  }

  logInfo("Cart item added", { userId, productId, variantId, quantity });
  return getCart(userId);
}

export async function updateCartItemQuantity(userId, cartItemId, quantity) {
  if (!userId) validationError("userId");
  if (!cartItemId) validationError("cartItemId");
  if (quantity == null) validationError("quantity");

  if (quantity <= 0) {
    await userRepo.removeCartItem(userId, cartItemId);
  } else {
    const updated = await userRepo.setCartItemQuantity(userId, cartItemId, quantity);
    if (!updated) notFound("Stavka korpe");
  }

  return getCart(userId);
}

export async function removeFromCart(userId, cartItemId) {
  if (!userId) validationError("userId");
  if (!cartItemId) validationError("cartItemId");
  await userRepo.removeCartItem(userId, cartItemId);
  return getCart(userId);
}

export async function clearCart(userId) {
  if (!userId) validationError("userId");
  await userRepo.clearCart(userId);
  return { success: true };
}

/**
 * Merges a guest's session-held cart into their own cart at login - matching
 * quantities of matching (product, variant) pairs are summed, everything else is
 * appended. The merge arithmetic lives here deliberately (not in the repository -
 * see user.repository.js's replaceCart comment): it's business logic, the
 * repository just persists whatever this computes.
 */
export async function mergeGuestCart(userId, guestCartItems = []) {
  if (!userId) validationError("userId");
  if (!guestCartItems.length) return getCart(userId);

  const user = await userRepo.findUserById(userId);
  if (!user) notFound("Korisnik");

  const merged = (user.cart || []).map((line) => ({
    product: line.product.toString(),
    variant: line.variant?.toString() || null,
    quantity: line.quantity,
  }));

  for (const guestLine of guestCartItems) {
    const existing = merged.find(
      (l) => l.product === String(guestLine.productId) && l.variant === (guestLine.variantId ? String(guestLine.variantId) : null)
    );
    if (existing) {
      existing.quantity += guestLine.quantity;
    } else {
      merged.push({ product: guestLine.productId, variant: guestLine.variantId || null, quantity: guestLine.quantity });
    }
  }

  await userRepo.replaceCart(userId, merged);
  logInfo("Guest cart merged", { userId, mergedLines: guestCartItems.length });
  return getCart(userId);
}

// ==================== ADDRESSES ====================

export async function getAddresses(userId) {
  if (!userId) validationError("userId");
  const user = await userRepo.findUserById(userId);
  if (!user) notFound("Korisnik");
  return mapUserAddresses(user);
}

export async function addAddress(userId, addressData) {
  if (!userId) validationError("userId");
  const record = buildAddressRecord(addressData);
  if (!record) badRequest("Nepotpuna adresa");

  await userRepo.addAddressToUser(userId, record);

  if (addressData.isDefault) {
    const user = await userRepo.findUserById(userId);
    const justAdded = (user.addresses || []).find((a) => a.hash === record.hash);
    if (justAdded) await userRepo.setDefaultAddress(userId, justAdded._id);
  }

  logInfo("Address added", { userId });
  return getAddresses(userId);
}

export async function removeAddress(userId, addressId) {
  if (!userId) validationError("userId");
  if (!addressId) validationError("addressId");
  await userRepo.removeAddressFromUser(userId, addressId);
  return getAddresses(userId);
}

export async function setDefaultAddress(userId, addressId) {
  if (!userId) validationError("userId");
  if (!addressId) validationError("addressId");
  const updated = await userRepo.setDefaultAddress(userId, addressId);
  if (!updated) notFound("Adresa");
  return getAddresses(userId);
}

export default {
  listUsers,
  getUserById,
  findUserProfile,
  findUserByEmail,
  findUserForLogin,
  registerUser,
  findOrCreateGoogleUser,
  createGuestUser,
  confirmAccount,
  setPasswordResetToken,
  resetPassword,
  changePassword,
  deactivateAccount,
  updateProfile,
  updateUserStatus,
  updateUserRole,
  updateLastLogin,
  findUserById,
  verifyUserByAdmin,
  deleteUser,
  getCart,
  getCartItemCount,
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
  mergeGuestCart,
  getAddresses,
  addAddress,
  removeAddress,
  setDefaultAddress,
};