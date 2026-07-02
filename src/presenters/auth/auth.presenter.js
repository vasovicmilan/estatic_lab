export function prepareLoginFormData({ errors = {}, formData = {}, redirectTo = "/" } = {}) {
  return {
    formAction: "/prijava",
    errors,
    formData: { email: formData.email || "" },
    redirectTo,
    googleAuthUrl: "/auth/google",
    breadcrumbs: [{ label: "Prijava", url: null }],
  };
}

export function prepareRegisterFormData({ errors = {}, formData = {} } = {}) {
  return {
    formAction: "/registracija",
    errors,
    formData: {
      firstName: formData.firstName || "",
      lastName: formData.lastName || "",
      email: formData.email || "",
      phone: formData.phone || "",
    },
    googleAuthUrl: "/auth/google",
    breadcrumbs: [{ label: "Registracija", url: null }],
  };
}

export function prepareForgotPasswordFormData({ errors = {}, formData = {} } = {}) {
  return {
    formAction: "/zaboravljena-lozinka",
    errors,
    formData: { email: formData.email || "" },
    breadcrumbs: [{ label: "Zaboravljena lozinka", url: null }],
  };
}

export function prepareResetPasswordFormData(token, { errors = {} } = {}) {
  return {
    formAction: `/resetovanje-lozinke/${token}`,
    errors,
    breadcrumbs: [{ label: "Nova lozinka", url: null }],
  };
}

export function prepareClaimAccountData(user) {
  return {
    email: user.email,
    imePrezime: user.imePrezime,
    formAction: `/preuzmi-nalog/${user.claimToken}`,
    breadcrumbs: [{ label: "Preuzmite vaš nalog", url: null }],
  };
}