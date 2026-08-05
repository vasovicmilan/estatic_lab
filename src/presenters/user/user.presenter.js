import { canUserCancelAppointment, getRescheduleWindow } from "../../utils/appointment-cancellation.util.js";
import { canUserCancelOrder } from "../../models/order-status-transitions.js";

export function prepareProfileTabData(user) {
  return {
    user,
    editUrl: "/nalog/podesavanja",
  };
}

export function prepareAppointmentTabData(result, query = {}) {
  return {
    appointments: result.data,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/nalog/termini",
      query,
    },
    filters: [
      { value: "", label: "Svi" },
      { value: "pending", label: "Na čekanju" },
      { value: "confirmed", label: "Potvrđeno" },
      { value: "completed", label: "Završeno" },
      { value: "cancelled", label: "Otkazano" },
    ],
  };
}

export function prepareAppointmentDetailData(appointment) {
  const rescheduleWindow = getRescheduleWindow(appointment.statusRaw, appointment.termin?.pocetakRaw);
  return {
    appointment,
    canCancel: canUserCancelAppointment(appointment.statusRaw, appointment.termin?.pocetakRaw),
    // "forbidden" hides the reschedule action entirely; "same_day_only" still
    // shows it but the form/UI should constrain date pickers to the current
    // appointment's day - the raw window value lets the view decide how to
    // present that constraint without re-deriving the rule itself.
    canReschedule: rescheduleWindow !== "forbidden",
    rescheduleWindow,
    rescheduleActionUrl: `/nalog/termini/${appointment.id}/pomeri`,
    backUrl: "/nalog/termini",
  };
}

export function prepareSettingsTabData(user, { errors = {} } = {}) {
  return {
    formAction: "/nalog/podesavanja",
    formData: {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.telefon || "",
    },
    errors,
    changePasswordUrl: "/nalog/promena-lozinke",
    deactivateUrl: "/nalog/deaktivacija",
  };
}

export function prepareOrdersTabData(result, query = {}) {
  return {
    orders: result.data,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/nalog/porudzbine",
      query,
    },
    filters: [
      { value: "", label: "Sve" },
      { value: "pending", label: "Na čekanju" },
      { value: "processing", label: "U obradi" },
      { value: "shipped", label: "Poslato" },
      { value: "delivered", label: "Dostavljeno" },
      { value: "completed", label: "Završeno" },
      { value: "cancelled", label: "Otkazano" },
    ],
  };
}

export function prepareOrderDetailData(order) {
  return {
    order,
    canCancel: canUserCancelOrder(order.statusRaw),
    backUrl: "/nalog/porudzbine",
  };
}

export function prepareAddressesTabData(addresses = []) {
  return {
    addresses,
    addUrl: "/nalog/adrese",
  };
}

export function prepareCartTabData(cart) {
  return {
    cart,
    checkoutUrl: "/korpa/naplata",
  };
}