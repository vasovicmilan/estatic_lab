import * as authService from "../../../services/auth.service.js";
import { logError, logInfo } from "../../../utils/logger.util.js";

// Every action here calls the exact same auth.service.js functions the web
// controller (controllers/web/auth/auth.controller.js) calls - no business logic
// duplicated. The difference is entirely in what happens with the result: the web
// controller sets req.session.user and redirects; these just return the JSON the
// service already produces. auth.service.js's login()/googleAuth() already embed
// roleName/permissions/isEmployee/isPartner directly in the signed JWT (see
// auth.middleware.js's apiAuthMiddleware), so the token returned here is
// immediately usable as a Bearer token against every gated /api/v1 route.

export async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    logInfo(`[api/register] Nalog kreiran: "${result.email}"`, { userId: result.id, isFirstUser: result.isFirstUser });

    return res.status(201).json({
      success: true,
      data: {
        id: result.id,
        email: result.email,
        isFirstUser: result.isFirstUser,
        message: result.isFirstUser
          ? "Nalog je uspešno kreiran kao administrator."
          : "Nalog je uspešno kreiran. Proverite email da biste potvrdili registraciju.",
      },
    });
  } catch (error) {
    logError("[api/register] Greška pri registraciji", error, { body: { ...req.body, password: "***", passwordConfirm: "***" } });
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const user = await authService.login(req.body.email, req.body.password);
    logInfo(`[api/login] Korisnik "${user.email}" uspešno prijavljen`, { userId: user.id });

    return res.json({
      success: true,
      data: {
        token: user.token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roleName: user.roleName,
          permissions: user.permissions,
          isEmployee: user.isEmployee,
          isPartner: user.isPartner,
        },
      },
    });
  } catch (error) {
    logError("[api/login] Greška pri prijavi", error, { email: req.body.email });
    next(error);
  }
}

export async function requestPasswordReset(req, res, next) {
  try {
    await authService.requestPasswordReset(req.body.email);
    // Same non-committal response regardless of whether the email exists - avoids
    // leaking which emails are registered (identical reasoning to the web flow).
    return res.json({ success: true, data: { message: "Ako nalog postoji, poslat je email sa uputstvom za resetovanje lozinke." } });
  } catch (error) {
    logError("[api/requestPasswordReset] Greška", error, { email: req.body.email });
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    await authService.resetPassword(req.params.token, req.body.newPassword, req.body.confirmPassword);
    return res.json({ success: true, data: { message: "Lozinka je uspešno resetovana." } });
  } catch (error) {
    logError("[api/resetPassword] Greška", error, { token: req.params.token });
    next(error);
  }
}

export async function verifyAccount(req, res, next) {
  try {
    const result = await authService.verifyAccount(req.params.token);
    return res.json({ success: true, data: { email: result.email, message: "Nalog je uspešno verifikovan." } });
  } catch (error) {
    logError("[api/verifyAccount] Greška", error, { token: req.params.token });
    next(error);
  }
}

// Returns the authenticated caller's own identity, straight from the verified JWT
// (apiAuthMiddleware already set req.user to the decoded payload - no DB round trip
// needed just to echo back who the token belongs to).
export async function me(req, res) {
  return res.json({
    success: true,
    data: {
      id: req.user.id,
      email: req.user.email,
      roleName: req.user.roleName,
      permissions: req.user.permissions,
      isEmployee: req.user.isEmployee,
      isPartner: req.user.isPartner,
    },
  });
}

export default { register, login, requestPasswordReset, resetPassword, verifyAccount, me };
