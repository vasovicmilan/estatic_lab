import * as userService from "../../../services/user.service.js";
import * as appointmentService from "../../../services/appointment.service.js";
import {
  prepareProfileTabData,
  prepareAppointmentTabData,
  prepareAppointmentDetailData,
  prepareSettingsTabData,
} from "../../../presenters/user/user.presenter.js";
import { logError, logWarn, logInfo } from "../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../utils/flash.util.js";

export async function profile(req, res, next) {
  try {
    const user = await userService.findUserProfile(req.session.user.id);
    const viewData = prepareProfileTabData(user);

    return res.render("user/profile", {
      pageTitle: "Moj profil",
      pageDescription: user.imePrezime,
      data: viewData,
    });
  } catch (error) {
    logError("[profile] Greška pri učitavanju profila", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function appointments(req, res, next) {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const result = await appointmentService.findAppointments({
      requesterId: req.session.user.id,
      role: "user",
      filters: { status: status || undefined },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareAppointmentTabData(result, req.query);

    return res.render("user/_appointment-tab", {
      pageTitle: "Moji termini",
      pageDescription: "Pregled vaših zakazanih termina",
      data: viewData,
    });
  } catch (error) {
    logError("[appointments] Greška pri učitavanju termina korisnika", error, { userId: req.session?.user?.id, ...req.query });
    next(error);
  }
}

export async function appointmentDetails(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const appointment = await appointmentService.getAppointmentById(appointmentId, req.session.user.id, "user");
    const viewData = prepareAppointmentDetailData(appointment);

    return res.render("user/appointment-details", {
      pageTitle: `Termin — ${appointment.usluga.naziv}`,
      pageDescription: appointment.termin.pocetak,
      data: viewData,
    });
  } catch (error) {
    logError("[appointmentDetails] Greška pri učitavanju detalja termina", error, {
      appointmentId: req.params.appointmentId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function cancelAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    await appointmentService.cancelAppointment(appointmentId, req.body.reason, req.session.user.id, "user");
    logInfo(`[cancelAppointment] Korisnik otkazao termin #${appointmentId}`, { appointmentId, userId: req.session.user.id });

    return flashAndRedirect(req, res, "success", "Termin je uspešno otkazan", "/nalog/termini");
  } catch (error) {
    logError("[cancelAppointment] Greška pri otkazivanju termina", error, {
      appointmentId: req.params.appointmentId,
      userId: req.session?.user?.id,
    });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/nalog/termini/detalji/${req.params.appointmentId}`);
    }
    next(error);
  }
}

export async function settingsForm(req, res, next) {
  try {
    const user = await userService.findUserProfile(req.session.user.id);
    const viewData = prepareSettingsTabData(user);

    return res.render("user/_settings-tab", {
      pageTitle: "Podešavanja naloga",
      pageDescription: user.imePrezime,
      data: { ...viewData, csrfToken: req.csrfToken?.() },
    });
  } catch (error) {
    logError("[settingsForm] Greška pri učitavanju podešavanja", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function updateSettings(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[updateSettings] Validacione greške pri ažuriranju podešavanja", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      const user = await userService.findUserProfile(req.session.user.id);
      const viewData = prepareSettingsTabData(user, { errors: req.validationErrors });
      return res.status(400).render("user/_settings-tab", {
        pageTitle: "Podešavanja naloga",
        pageDescription: user.imePrezime,
        data: { ...viewData, formData: req.body, csrfToken: req.csrfToken?.() },
      });
    }

    const updated = await userService.updateProfile(req.session.user.id, req.body);
    req.session.user.firstName = updated.firstName;
    req.session.user.lastName = updated.lastName;

    logInfo(`[updateSettings] Korisnik #${req.session.user.id} ažurirao podešavanja`, { userId: req.session.user.id });

    return flashAndRedirect(req, res, "success", "Podešavanja su uspešno ažurirana", "/nalog/podesavanja");
  } catch (error) {
    logError("[updateSettings] Greška pri ažuriranju podešavanja", error, { userId: req.session?.user?.id, body: req.body });

    if (error.statusCode === 400 || error.statusCode === 404) {
      const user = await userService.findUserProfile(req.session.user.id).catch(() => null);
      const viewData = prepareSettingsTabData(user || {}, { errors: { general: error.message } });
      return res.status(error.statusCode).render("user/_settings-tab", {
        pageTitle: "Podešavanja naloga",
        pageDescription: user?.imePrezime || "",
        data: { ...viewData, formData: req.body, csrfToken: req.csrfToken?.() },
      });
    }
    next(error);
  }
}

export default {
  profile,
  appointments,
  appointmentDetails,
  cancelAppointment,
  settingsForm,
  updateSettings,
};