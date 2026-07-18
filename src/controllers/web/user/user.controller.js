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
      pageTitle: `Termin - ${appointment.usluga.naziv}`,
      pageDescription: appointment.termin.pocetak,
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
        data: { ...viewData, formData: req.body, csrfToken: res.locals.csrfToken },
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

    return res.render("user/_order-tab", {
      pageTitle: "Moje porudžbine",
      pageDescription: "Pregled vaših porudžbina",
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

    return res.render("user/order-details", {
      pageTitle: "Detalji porudžbine",
      pageDescription: order.ukupnaCena,
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

    return res.render("user/_addresses-tab", {
      pageTitle: "Moje adrese",
      pageDescription: "Upravljajte sačuvanim adresama za dostavu",
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