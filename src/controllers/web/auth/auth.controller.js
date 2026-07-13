import * as authService from "../../../services/auth.service.js";
import {
  prepareLoginFormData,
  prepareRegisterFormData,
  prepareForgotPasswordFormData,
  prepareResetPasswordFormData,
} from "../../../presenters/auth/auth.presenter.js";
import { logError, logWarn, logInfo } from "../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../utils/flash.util.js";
import { generateRandomToken } from "../../../services/crypto.service.js";

async function exchangeGoogleCodeForProfile(code) {
  const tokenUrl = "https://oauth2.googleapis.com/token";
  const params = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
  });
  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!tokenResponse.ok) {
    throw new Error("Failed to exchange code for token");
  }
  const tokenData = await tokenResponse.json();
  const { access_token } = tokenData;
  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!userInfoResponse.ok) {
    throw new Error("Failed to fetch user info");
  }
  const profile = await userInfoResponse.json();
  return {
    googleId: profile.id,
    email: profile.email,
    firstName: profile.given_name || "Korisnik",
    lastName: profile.family_name || "",
    avatar: profile.picture || "",
  };
}

function setSessionUser(req, user) {
  req.session.isLoggedIn = true;
  req.session.user = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roleId: user.roleId,
    roleName: user.roleName,
    permissions: user.permissions || [],
  };
}

export async function loginForm(req, res, next) {
  try {
    if (req.session?.isLoggedIn) return res.redirect("/");
    const viewData = prepareLoginFormData({ redirectTo: req.query.redirect || "/" });
    return res.render("auth/_auth-form", {
      pageTitle: "Prijava",
      pageDescription: "Prijavite se na vaš nalog",
      data: { ...viewData, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[loginForm] Greška pri prikazu forme za prijavu", error);
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const redirectTo = req.body.redirectTo || "/";

    if (req.validationErrors) {
      logWarn("[login] Validacione greške pri prijavi", { validationErrors: req.validationErrors, email: req.body.email });
      const viewData = prepareLoginFormData({ errors: req.validationErrors, formData: req.body, redirectTo });
      return res.status(400).render("auth/_auth-form", {
        pageTitle: "Prijava",
        pageDescription: "Prijavite se na vaš nalog",
        data: { ...viewData, csrfToken: res.locals.csrfToken },
      });
    }

    const user = await authService.login(req.body.email, req.body.password);
    setSessionUser(req, user);

    logInfo(`[login] Korisnik "${user.email}" uspešno prijavljen`, { userId: user.id });

    return flashAndRedirect(req, res, "success", `Dobrodošli nazad, ${user.firstName}!`, redirectTo);
  } catch (error) {
    logError("[login] Greška pri prijavi", error, { email: req.body.email });

    if (error.statusCode === 401 || error.statusCode === 400) {
      const viewData = prepareLoginFormData({ errors: { general: error.message }, formData: req.body, redirectTo: req.body.redirectTo });
      return res.status(error.statusCode).render("auth/_auth-form", {
        pageTitle: "Prijava",
        pageDescription: "Prijavite se na vaš nalog",
        data: { ...viewData, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function registerForm(req, res, next) {
  try {
    if (req.session?.isLoggedIn) return res.redirect("/");
    const viewData = prepareRegisterFormData({});
    return res.render("auth/_auth-form", {
      pageTitle: "Registracija",
      pageDescription: "Kreirajte novi nalog",
      data: { ...viewData, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[registerForm] Greška pri prikazu forme za registraciju", error);
    next(error);
  }
}

export async function register(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[register] Validacione greške pri registraciji", { validationErrors: req.validationErrors, email: req.body.email });
      const viewData = prepareRegisterFormData({ errors: req.validationErrors, formData: req.body });
      return res.status(400).render("auth/_auth-form", {
        pageTitle: "Registracija",
        pageDescription: "Kreirajte novi nalog",
        data: { ...viewData, csrfToken: res.locals.csrfToken },
      });
    }

    const result = await authService.register(req.body);
    logInfo(`[register] Nalog kreiran: "${result.email}"`, { userId: result.id, isFirstUser: result.isFirstUser });

    return flashAndRedirect(
      req,
      res,
      "success",
      result.isFirstUser
        ? "Nalog je uspešno kreiran kao administrator. Možete se prijaviti."
        : "Nalog je uspešno kreiran! Proverite vaš email da biste potvrdili registraciju.",
      "/prijava"
    );
  } catch (error) {
    logError("[register] Greška pri registraciji", error, { body: { ...req.body, password: "***", passwordConfirm: "***" } });

    if (error.statusCode === 400 || error.statusCode === 409) {
      const viewData = prepareRegisterFormData({ errors: { general: error.message }, formData: req.body });
      return res.status(error.statusCode).render("auth/_auth-form", {
        pageTitle: "Registracija",
        pageDescription: "Kreirajte novi nalog",
        data: { ...viewData, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function redirectToGoogle(req, res) {
  const state = generateRandomToken(16);
  req.session.googleOAuthState = state;
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=email%20profile&state=${state}`;
  res.redirect(authUrl);
}

export async function googleCallback(req, res, next) {
  try {
    const { code, state } = req.query;

    const expectedState = req.session.googleOAuthState;
    delete req.session.googleOAuthState;

    if (!state || state !== expectedState) {
      logWarn("[googleCallback] State parametar se ne poklapa — moguć CSRF pokušaj");
      return flashAndRedirect(req, res, "error", "Sesija je istekla, pokušajte ponovo.", "/prijava");
    }

    if (!code) {
      logWarn("[googleCallback] Nedostaje autorizacioni kod");
      return flashAndRedirect(req, res, "error", "Nedostaje autorizacioni kod.", "/prijava");
    }

    const googleProfile = await exchangeGoogleCodeForProfile(code);

    const { isNewUser, user } = await authService.googleAuth({
      googleId: googleProfile.googleId,
      email: googleProfile.email,
      firstName: googleProfile.firstName,
      lastName: googleProfile.lastName,
      avatar: googleProfile.avatar,
    });

    setSessionUser(req, user);

    logInfo(`[googleCallback] Google prijava uspešna za "${user.email}"`, { userId: user.id, isNewUser });

    return flashAndRedirect(
      req,
      res,
      "success",
      isNewUser ? `Dobrodošli, ${user.firstName}!` : `Dobrodošli nazad, ${user.firstName}!`,
      "/"
    );
  } catch (error) {
    logError("[googleCallback] Greška pri Google prijavi", error);
    return flashAndRedirect(req, res, "error", "Prijava preko Google-a nije uspela. Pokušajte ponovo.", "/prijava");
  }
}

export async function logout(req, res, next) {
  const email = req.session?.user?.email;
  req.session.destroy((err) => {
    if (err) {
      logError("[logout] Greška pri uništavanju sesije", err, { email });
      return next(err);
    }
    logInfo(`[logout] Korisnik "${email}" odjavljen`, { email });
    res.clearCookie("connect.sid");
    return res.redirect("/");
  });
}

export async function verifyAccount(req, res, next) {
  try {
    const result = await authService.verifyAccount(req.params.token);
    return flashAndRedirect(req, res, "success", `Nalog je uspešno potvrđen, ${result.firstName}! Možete se prijaviti.`, "/prijava");
  } catch (error) {
    logError("[verifyAccount] Greška pri verifikaciji naloga", error, { token: req.params.token });
    return flashAndRedirect(req, res, "error", error.message || "Link za verifikaciju je nevažeći ili istekao.", "/prijava");
  }
}

export async function forgotPasswordForm(req, res, next) {
  try {
    const viewData = prepareForgotPasswordFormData({});
    return res.render("auth/_auth-form", {
      pageTitle: "Zaboravljena lozinka",
      pageDescription: "Resetujte vašu lozinku",
      data: { ...viewData, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[forgotPasswordForm] Greška pri prikazu forme", error);
    next(error);
  }
}

export async function requestPasswordReset(req, res, next) {
  try {
    if (req.validationErrors) {
      const viewData = prepareForgotPasswordFormData({ errors: req.validationErrors, formData: req.body });
      return res.status(400).render("auth/_auth-form", {
        pageTitle: "Zaboravljena lozinka",
        pageDescription: "Resetujte vašu lozinku",
        data: { ...viewData, csrfToken: res.locals.csrfToken },
      });
    }

    const result = await authService.requestPasswordReset(req.body.email);
    return flashAndRedirect(req, res, "success", result.message, "/prijava");
  } catch (error) {
    logError("[requestPasswordReset] Greška pri zahtevu za reset lozinke", error, { email: req.body.email });
    next(error);
  }
}

export async function resetPasswordForm(req, res, next) {
  try {
    const isAccountClaim = req.path.startsWith("/preuzmi-nalog");
    const viewData = prepareResetPasswordFormData(req.params.token, { isAccountClaim });
    return res.render("auth/_auth-form", {
      pageTitle: "Nova lozinka",
      pageDescription: "Postavite novu lozinku",
      data: { ...viewData, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[resetPasswordForm] Greška pri prikazu forme", error, { token: req.params.token });
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    if (req.validationErrors) {
      const isAccountClaim = req.path.startsWith("/preuzmi-nalog");
      const viewData = prepareResetPasswordFormData(req.params.token, { errors: req.validationErrors, isAccountClaim });
      return res.status(400).render("auth/_auth-form", {
        pageTitle: "Nova lozinka",
        pageDescription: "Postavite novu lozinku",
        data: { ...viewData, csrfToken: res.locals.csrfToken },
      });
    }

    await authService.resetPassword(req.params.token, req.body.newPassword, req.body.confirmPassword);
    return flashAndRedirect(req, res, "success", "Lozinka je uspešno promenjena. Možete se prijaviti.", "/prijava");
  } catch (error) {
    logError("[resetPassword] Greška pri resetovanju lozinke", error, { token: req.params.token });

    if (error.statusCode === 400) {
      const isAccountClaim = req.path.startsWith("/preuzmi-nalog");
      const viewData = prepareResetPasswordFormData(req.params.token, { errors: { general: error.message }, isAccountClaim });
      return res.status(400).render("auth/_auth-form", {
        pageTitle: "Nova lozinka",
        pageDescription: "Postavite novu lozinku",
        data: { ...viewData, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    if (req.validationErrors) {
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), "/nalog/podesavanja");
    }

    await authService.changePassword(req.session.user.id, req.body.oldPassword, req.body.newPassword, req.body.confirmPassword);
    logInfo(`[changePassword] Korisnik #${req.session.user.id} promenio lozinku`, { userId: req.session.user.id });

    return flashAndRedirect(req, res, "success", "Lozinka je uspešno promenjena", "/nalog/podesavanja");
  } catch (error) {
    logError("[changePassword] Greška pri promeni lozinke", error, { userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/nalog/podesavanja");
    }
    next(error);
  }
}

export async function deactivateAccount(req, res, next) {
  try {
    await authService.deactivateAccount(req.session.user.id, req.body.password);
    const email = req.session.user.email;

    req.session.destroy((err) => {
      if (err) logError("[deactivateAccount] Greška pri uništavanju sesije", err, { email });
      res.clearCookie("connect.sid");
      req.flash?.("success", "Vaš nalog je deaktiviran.");
      return res.redirect("/");
    });
  } catch (error) {
    logError("[deactivateAccount] Greška pri deaktivaciji naloga", error, { userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/nalog/podesavanja");
    }
    next(error);
  }
}

export default {
  loginForm,
  login,
  registerForm,
  register,
  redirectToGoogle,
  googleCallback,
  logout,
  verifyAccount,
  forgotPasswordForm,
  requestPasswordReset,
  resetPasswordForm,
  resetPassword,
  changePassword,
  deactivateAccount,
};