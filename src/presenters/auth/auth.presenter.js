const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CALLBACK_URL = "/prijava/google";

export function prepareLoginFormData({ errors = {}, formData = {}, redirectTo = "/" } = {}) {
  return {
    formType: "login",
    formAction: "/prijava",
    errors,
    formData: { email: formData.email || "" },
    redirectTo,
    googleClientId: GOOGLE_CLIENT_ID,
    googleCallbackUrl: GOOGLE_CALLBACK_URL,
    breadcrumbs: [{ label: "Prijava", url: null }],
  };
}

export function prepareRegisterFormData({ errors = {}, formData = {} } = {}) {
  return {
    formType: "register",
    formAction: "/registracija",
    errors,
    formData: {
      firstName: formData.firstName || "",
      lastName: formData.lastName || "",
      email: formData.email || "",
      phone: formData.phone || "",
    },
    googleClientId: GOOGLE_CLIENT_ID,
    googleCallbackUrl: GOOGLE_CALLBACK_URL,
    breadcrumbs: [{ label: "Registracija", url: null }],
  };
}

export function prepareForgotPasswordFormData({ errors = {}, formData = {} } = {}) {
  return {
    formType: "forgot-password",
    formAction: "/zaboravljena-lozinka",
    errors,
    formData: { email: formData.email || "" },
    breadcrumbs: [{ label: "Zaboravljena lozinka", url: null }],
  };
}

export function prepareResetPasswordFormData(token, { errors = {}, isAccountClaim = false } = {}) {
  return {
    formType: "reset-password",
    formAction: `/resetovanje-lozinke/${token}`,
    errors,
    isAccountClaim,
    breadcrumbs: [{ label: isAccountClaim ? "Preuzmite vaš nalog" : "Nova lozinka", url: null }],
  };
}

// shown after a guest booking creates a lightweight account — invites them to set a
// password via the same reset-token flow used for "forgot password"
export function prepareClaimAccountData(user) {
  return {
    email: user.email,
    imePrezime: user.imePrezime,
    formAction: `/preuzmi-nalog/${user.claimToken}`,
    breadcrumbs: [{ label: "Preuzmite vaš nalog", url: null }],
  };
}
