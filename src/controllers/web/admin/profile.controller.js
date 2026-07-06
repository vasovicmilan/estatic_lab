import * as userService from "../../../services/user.service.js";
import { prepareAdminProfileFormData } from "../../../presenters/admin/profile.presenter.js";
import { logError, logWarn, logInfo } from "../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../utils/flash.util.js";

export async function profileForm(req, res, next) {
  try {
    const user = await userService.findUserProfile(req.session.user.id);
    const formData = prepareAdminProfileFormData(user);

    return res.render("admin/_form", {
      pageTitle: "Moj profil",
      pageDescription: user.imePrezime,
      data: { ...formData, errors: {}, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[profileForm] Greška pri učitavanju profila administratora", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[updateProfile] Validacione greške pri ažuriranju profila", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const user = await userService.findUserProfile(req.session.user.id);
      const formData = prepareAdminProfileFormData(user);
      return res.status(400).render("admin/_form", {
        pageTitle: "Moj profil",
        pageDescription: user.imePrezime,
        data: { ...formData, errors: req.validationErrors, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const updated = await userService.updateProfile(req.session.user.id, req.body);
    req.session.user.firstName = updated.firstName;
    req.session.user.lastName = updated.lastName;

    logInfo(`[updateProfile] Administrator #${req.session.user.id} ažurirao profil`, { userId: req.session.user.id });

    return flashAndRedirect(req, res, "success", "Profil je uspešno ažuriran", "/admin/profil");
  } catch (error) {
    logError("[updateProfile] Greška pri ažuriranju profila administratora", error, { userId: req.session?.user?.id, body: req.body });

    if (error.statusCode === 400 || error.statusCode === 404) {
      const user = await userService.findUserProfile(req.session.user.id).catch(() => null);
      const formData = prepareAdminProfileFormData(user || {});
      return res.status(error.statusCode).render("admin/_form", {
        pageTitle: "Moj profil",
        pageDescription: user?.imePrezime || "",
        data: { ...formData, errors: { general: error.message }, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

export default { profileForm, updateProfile };