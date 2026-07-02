import * as userRepo from "../repositories/user.repository.js";
import * as roleService from "./role.service.js";
import { mapUser, mapUsersForAdminList, mapUserForAdminDetail, mapUserForProfile } from "../mappers/user.mapper.js";
import { hashPassword, comparePasswords, generateRandomToken } from "./crypto.service.js";
import { validationError, notFound, conflict, unauthorized, badRequest } from "../utils/error.util.js";
import { logInfo, logError } from "../utils/logger.util.js";

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

export async function listUsers({ search = "", status, role, provider, limit = 10, page = 1 } = {}) {
  const result = await userRepo.findUsers({
    search,
    limit,
    page,
    filters: { status, role, provider },
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
  return userRepo.findUserByEmail(email, { populateFields: [{ path: "role", select: "name" }] });
}

// raw (unmapped, password included) — used only by auth.service.js for credential checks
export async function findUserForLogin(email) {
  if (!email) validationError("email");
  return userRepo.findUserByEmailWithPassword(email);
}

export async function registerUser(data) {
  validateRegistrationData(data);

  const existing = await userRepo.findUserByEmail(data.email);
  if (existing) conflict("Nalog sa ovim email-om već postoji");

  const role = await roleService.findRoleByName("user");
  if (!role) badRequest("Podrazumevana rola za korisnike nije konfigurisana");

  const passwordHash = await hashPassword(data.password);
  const confirmToken = generateRandomToken();

  const created = await userRepo.createUser({
    email: data.email.toLowerCase().trim(),
    password: passwordHash,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone || "",
    role: role._id,
    provider: "local",
    status: "pending",
    confirmed: false,
    confirmToken,
    confirmTokenExpiration: new Date(Date.now() + CONFIRM_TOKEN_TTL_MS),
  });

  logInfo("User registered", { userId: created._id, email: created.email });

  return { id: created._id.toString(), email: created.email, firstName: created.firstName, confirmToken };
}

export async function findOrCreateGoogleUser(googleData) {
  if (!googleData?.email) validationError("email");
  if (!googleData?.googleId) validationError("googleId");

  let user = await userRepo.findUserByGoogleId(googleData.googleId);
  if (user) return user;

  // an account may already exist locally under the same email — link the Google id
  // instead of creating a duplicate account
  user = await userRepo.findUserByEmail(googleData.email);
  if (user) {
    return userRepo.updateUserById(user._id, {
      googleId: googleData.googleId,
      avatar: user.avatar || googleData.avatar || "",
    });
  }

  const role = await roleService.findRoleByName("user");
  if (!role) badRequest("Podrazumevana rola za korisnike nije konfigurisana");

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

  logInfo("User registered via Google", { userId: created._id, email: created.email });
  return created;
}

/**
 * Core of the guest-booking flow (see appointment.service.js). Looked up BEFORE the
 * booking transaction starts (read-only); if no account exists, the caller creates one
 * INSIDE the same transaction as the appointment write, passing the session through here.
 * `status: "guest"` + resetToken doubles as the "claim your account" link — same email
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
      phone: phone || "",
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
  const allowed = { firstName: data.firstName, lastName: data.lastName, phone: data.phone };
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

export async function deleteUser(userId) {
  if (!userId) validationError("userId");
  const existing = await userRepo.findUserById(userId);
  if (!existing) notFound("Korisnik");
  await userRepo.deleteUserById(userId);
  logInfo("User deleted", { userId });
  return { success: true };
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
  verifyUserByAdmin,
  deleteUser,
};