import * as userService from "../../../services/user.service.js";
import * as appointmentService from "../../../services/appointment.service.js";
import * as orderService from "../../../services/order.service.js";
import {
  prepareProfileTabData,
  prepareAppointmentTabData,
  prepareAppointmentDetailData,
  prepareSettingsTabData,
  prepareOrdersTabData,
  prepareOrderDetailData,
  prepareAddressesTabData,
} from "../../../presenters/user/user.presenter.js";
import { generateSeo } from "../../../seo/index.js";
import { logError, logWarn, logInfo } from "../../../utils/logger.util.js";
import auditLogService from "../../../services/audit-log.service.js";
import { flashAndRedirect } from "../../../utils/flash.util.js";

// Everything under /nalog is already behind webAuthMiddleware (see web.routes.js) -
// a crawler can never reach it without a session. Still explicitly noindex, same
// defense-in-depth convention as the public booking/shop/auth controllers: a future
// middleware bug or leaked URL shouldn't be the only thing standing between a
// customer's personal appointments/orders/addresses and a search index.
async function userSeo(req, { title, description }) {
  return generateSeo("page", { title, description, slug: req.originalUrl, noIndex: true }, req);
}

export async function profile(req, res, next) {
  try {
    const user = await userService.findUserProfile(req.session.user.id);
    const viewData = prepareProfileTabData(user);

    const seo = await userSeo(req, { title: "Moj profil", description: user.imePrezime });
    return res.render("user/profile", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
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

    const seo = await userSeo(req, { title: "Moji termini", description: "Pregled vaših zakazanih termina" });
    return res.render("user/_appointment-tab", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
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

    const seo = await userSeo(req, { title: `Termin - ${appointment.usluga.naziv}`, description: appointment.termin.pocetak });
    return res.render("user/appointment-details", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: { ...viewData, csrfToken: res.locals.csrfToken },
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
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "APPOINTMENT_CANCELLED",
      entity: { type: "Appointment", id: appointmentId },
      changes: { reason: { old: null, new: req.body.reason || null } },
      req,
      success: true,
    });

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

export async function rescheduleAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;

    if (req.validationErrors) {
      logWarn(`[rescheduleAppointment] Validacione greške za appointmentId=${appointmentId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), `/nalog/termini/detalji/${appointmentId}`);
    }

    const existing = await appointmentService.getAppointmentById(appointmentId, req.session.user.id, "user").catch(() => null);
    await appointmentService.rescheduleAppointment(appointmentId, req.body.newStartTime, req.session.user.id, "user");
    logInfo(`[rescheduleAppointment] Korisnik pomerio termin #${appointmentId}`, { appointmentId, newStartTime: req.body.newStartTime, userId: req.session.user.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "APPOINTMENT_RESCHEDULED",
      entity: { type: "Appointment", id: appointmentId },
      changes: { pocetak: { old: existing?.termin?.pocetakRaw ?? null, new: req.body.newStartTime || null } },
      req,
      success: true,
    });

    return flashAndRedirect(req, res, "success", "Termin je uspešno pomeren", `/nalog/termini/detalji/${appointmentId}`);
  } catch (error) {
    logError("[rescheduleAppointment] Greška pri pomeranju termina", error, {
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

    const seo = await userSeo(req, { title: "Podešavanja naloga", description: user.imePrezime });
    return res.render("user/_settings-tab", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: { ...viewData, csrfToken: res.locals.csrfToken },
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
        seo: await userSeo(req, { title: "Podešavanja naloga", description: user.imePrezime }),
        data: { ...viewData, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }

    const existing = await userService.findUserProfile(req.session.user.id);
    const updated = await userService.updateProfile(req.session.user.id, req.body);
    req.session.user.firstName = updated.firstName;
    req.session.user.lastName = updated.lastName;

    logInfo(`[updateSettings] Korisnik #${req.session.user.id} ažurirao podešavanja`, { userId: req.session.user.id });
    const changes = auditLogService.computeChanges(existing, updated, ["firstName", "lastName", "telefon"]);
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "USER_SETTINGS_UPDATED",
      entity: { type: "User", id: req.session.user.id },
      changes,
      req,
      success: true,
    });

    return flashAndRedirect(req, res, "success", "Podešavanja su uspešno ažurirana", "/nalog/podesavanja");
  } catch (error) {
    logError("[updateSettings] Greška pri ažuriranju podešavanja", error, { userId: req.session?.user?.id, body: req.body });

    if (error.statusCode === 400 || error.statusCode === 404) {
      const user = await userService.findUserProfile(req.session.user.id).catch(() => null);
      const viewData = prepareSettingsTabData(user || {}, { errors: { general: error.message } });
      return res.status(error.statusCode).render("user/_settings-tab", {
        pageTitle: "Podešavanja naloga",
        pageDescription: user?.imePrezime || "",
        seo: await userSeo(req, { title: "Podešavanja naloga", description: user?.imePrezime || "" }),
        data: { ...viewData, formData: req.body, csrfToken: res.locals.csrfToken },
      });
    }
    next(error);
  }
}

// ==================== ORDERS ====================

export async function orders(req, res, next) {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const result = await orderService.findOrders({
      requesterId: req.session.user.id,
      role: "user",
      filters: { status: status || undefined },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareOrdersTabData(result, req.query);

    const seo = await userSeo(req, { title: "Moje porudžbine", description: "Pregled vaših porudžbina" });
    return res.render("user/_order-tab", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: viewData,
    });
  } catch (error) {
    logError("[orders] Greška pri učitavanju porudžbina korisnika", error, { userId: req.session?.user?.id, ...req.query });
    next(error);
  }
}

export async function orderDetails(req, res, next) {
  try {
    const { orderId } = req.params;
    const order = await orderService.getOrderById(orderId, req.session.user.id, "user");
    const viewData = prepareOrderDetailData(order);

    const seo = await userSeo(req, { title: "Detalji porudžbine", description: order.ukupnaCena });
    return res.render("user/order-details", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: { ...viewData, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[orderDetails] Greška pri učitavanju detalja porudžbine", error, {
      orderId: req.params.orderId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function cancelOrder(req, res, next) {
  try {
    const { orderId } = req.params;
    await orderService.cancelOrder(orderId, req.body.reason, req.session.user.id, "user");
    logInfo(`[cancelOrder] Korisnik otkazao porudžbinu #${orderId}`, { orderId, userId: req.session.user.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "ORDER_CANCELLED",
      entity: { type: "Order", id: orderId },
      changes: { reason: { old: null, new: req.body.reason || null } },
      req,
      success: true,
    });

    return flashAndRedirect(req, res, "success", "Porudžbina je uspešno otkazana", "/nalog/porudzbine");
  } catch (error) {
    logError("[cancelOrder] Greška pri otkazivanju porudžbine", error, {
      orderId: req.params.orderId,
      userId: req.session?.user?.id,
    });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/nalog/porudzbine/detalji/${req.params.orderId}`);
    }
    next(error);
  }
}

// ==================== ADDRESSES ====================

export async function addresses(req, res, next) {
  try {
    const addressList = await userService.getAddresses(req.session.user.id);
    const viewData = prepareAddressesTabData(addressList);

    const seo = await userSeo(req, { title: "Moje adrese", description: "Upravljajte sačuvanim adresama za dostavu" });
    return res.render("user/_addresses-tab", {
      pageTitle: seo.title,
      pageDescription: seo.description,
      seo,
      data: { ...viewData, csrfToken: res.locals.csrfToken },
    });
  } catch (error) {
    logError("[addresses] Greška pri učitavanju adresa korisnika", error, { userId: req.session?.user?.id });
    next(error);
  }
}

export async function addAddress(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[addAddress] Validacione greške pri dodavanju adrese", { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), "/nalog/adrese");
    }

    await userService.addAddress(req.session.user.id, {
      label: req.body.label,
      city: req.body.city,
      postalCode: req.body.postalCode,
      street: req.body.street,
      number: req.body.number,
      isDefault: req.body.isDefault === "true" || req.body.isDefault === "on",
    });
    logInfo("[addAddress] Adresa dodata", { userId: req.session.user.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "USER_ADDRESS_ADDED",
      entity: { type: "User", id: req.session.user.id },
      req,
      success: true,
    });

    return flashAndRedirect(req, res, "success", "Adresa je uspešno dodata", "/nalog/adrese");
  } catch (error) {
    logError("[addAddress] Greška pri dodavanju adrese", error, { userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/nalog/adrese");
    }
    next(error);
  }
}

export async function removeAddress(req, res, next) {
  try {
    const { addressId } = req.params;
    await userService.removeAddress(req.session.user.id, addressId);
    logInfo("[removeAddress] Adresa uklonjena", { userId: req.session.user.id, addressId });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "USER_ADDRESS_REMOVED",
      entity: { type: "User", id: req.session.user.id },
      req,
      success: true,
    });

    return flashAndRedirect(req, res, "success", "Adresa je uklonjena", "/nalog/adrese");
  } catch (error) {
    logError("[removeAddress] Greška pri uklanjanju adrese", error, { addressId: req.params.addressId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/nalog/adrese");
    }
    next(error);
  }
}

export async function setDefaultAddress(req, res, next) {
  try {
    const { addressId } = req.params;
    await userService.setDefaultAddress(req.session.user.id, addressId);
    logInfo("[setDefaultAddress] Podrazumevana adresa promenjena", { userId: req.session.user.id, addressId });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "USER_DEFAULT_ADDRESS_CHANGED",
      entity: { type: "User", id: req.session.user.id },
      changes: { addressId: { old: null, new: addressId } },
      req,
      success: true,
    });

    return flashAndRedirect(req, res, "success", "Podrazumevana adresa je ažurirana", "/nalog/adrese");
  } catch (error) {
    logError("[setDefaultAddress] Greška pri postavljanju podrazumevane adrese", error, { addressId: req.params.addressId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/nalog/adrese");
    }
    next(error);
  }
}

export default {
  profile,
  appointments,
  appointmentDetails,
  cancelAppointment,
  rescheduleAppointment,
  settingsForm,
  updateSettings,
  orders,
  orderDetails,
  cancelOrder,
  addresses,
  addAddress,
  removeAddress,
  setDefaultAddress,
};