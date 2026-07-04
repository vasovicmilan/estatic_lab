import eventEmitter from "../events/event.emitter.js";
import * as userService from "./user.service.js";
import { comparePasswords, signJwt } from "./crypto.service.js";
import { validationError, unauthorized, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

export async function register(data) {
  const result = await userService.registerUser(data);

  eventEmitter.emit("user:registered", {
    email: result.email,
    firstName: result.firstName,
    userId: result.id,
    confirmToken: result.confirmToken,
  });

  return result;
}

export async function login(email, password) {
  if (!email) validationError("email");
  if (!password) validationError("password");

  const user = await userService.findUserForLogin(email);
  if (!user) unauthorized("Pogrešan email ili lozinka");
  if (!user.password) unauthorized("Ovaj nalog je povezan sa Google prijavom");

  if (user.status === "suspended") unauthorized("Vaš nalog je suspendovan");
  if (user.status === "pending") unauthorized("Nalog nije potvrđen. Proverite vaš email.");

  const isValid = await comparePasswords(password, user.password);
  if (!isValid) unauthorized("Pogrešan email ili lozinka");

  await userService.updateLastLogin(user._id);
  if (user.status === "inactive") {
    await userService.updateUserStatus(user._id, "active");
  }

  const token = signJwt({ id: user._id, email: user.email, role: user.role?._id || user.role });

  logInfo("User logged in", { userId: user._id, email: user.email });

  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roleId: (user.role?._id || user.role).toString(),
    roleName: user.role?.name || "user",
    token,
  };
}

export async function googleAuth(googleData) {
  if (!googleData?.email) validationError("email");
  if (!googleData?.googleId) validationError("googleId");

  const created = await userService.findOrCreateGoogleUser(googleData);
  await userService.updateLastLogin(created._id);

  // findOrCreateGoogleUser doesn't populate role — re-fetch so the session gets a role name
  const user = await userService.findUserByEmail(created.email);

  const isNewUser = !user.createdAt || Date.now() - new Date(user.createdAt).getTime() < 5000;
  const token = signJwt({ id: user._id, email: user.email, role: user.role?._id || user.role });

  if (isNewUser) {
    eventEmitter.emit("user:registered", { email: user.email, firstName: user.firstName, userId: user._id, provider: "google" });
  }

  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: (user.role?._id || user.role).toString(),
      roleName: user.role?.name || "user",
      token,
    },
    isNewUser,
  };
}

export async function verifyAccount(token) {
  if (!token) validationError("token");
  const result = await userService.confirmAccount(token);
  eventEmitter.emit("user:confirmed", result);
  return result;
}

export async function requestPasswordReset(email) {
  if (!email) validationError("email");
  const user = await userService.findUserByEmail(email);
  // deliberately the same response whether or not the email exists — don't leak
  // account existence through response timing/content
  if (!user) return { message: "Ako email postoji, poslat je link za reset lozinke" };

  const result = await userService.setPasswordResetToken(user._id);
  eventEmitter.emit("user:password_reset_requested", {
    email: user.email,
    firstName: user.firstName,
    resetToken: result.token,
  });
  return { message: "Ako email postoji, poslat je link za reset lozinke" };
}

export async function resetPassword(token, newPassword, confirmPassword) {
  if (!token) validationError("token");
  if (!newPassword) validationError("newPassword");
  if (newPassword !== confirmPassword) badRequest("Lozinke se ne poklapaju");

  const result = await userService.resetPassword(token, newPassword);
  eventEmitter.emit("user:password_changed", result);
  return result;
}

export async function changePassword(userId, oldPassword, newPassword, confirmPassword) {
  if (newPassword !== confirmPassword) badRequest("Lozinke se ne poklapaju");
  const result = await userService.changePassword(userId, oldPassword, newPassword);
  eventEmitter.emit("user:password_changed", result);
  return result;
}

export async function deactivateAccount(userId, password) {
  const result = await userService.deactivateAccount(userId, password);
  eventEmitter.emit("user:deactivated", result);
  return result;
}

export async function resendVerificationEmail(email) {
  if (!email) validationError("email");
  const user = await userService.findUserByEmail(email);
  if (!user) return { message: "Ako email postoji, poslat je novi verifikacioni link" };
  if (user.confirmed) badRequest("Nalog je već verifikovan");

  const result = await userService.setPasswordResetToken(user._id);
  eventEmitter.emit("user:confirmation_resent", { email: user.email, firstName: user.firstName, confirmToken: result.token });
  return { message: "Ako email postoji, poslat je novi verifikacioni link" };
}

export async function verifyAccountByAdmin(userId) {
  if (!userId) validationError("userId");
  return userService.verifyUserByAdmin(userId);
}

export default {
  register,
  login,
  googleAuth,
  verifyAccount,
  requestPasswordReset,
  resetPassword,
  changePassword,
  deactivateAccount,
  resendVerificationEmail,
  verifyAccountByAdmin,
};
