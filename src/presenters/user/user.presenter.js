import { canUserCancelAppointment, getRescheduleWindow } from "../../utils/appointment-cancellation.util.js";
import { canUserCancelOrder } from "../../models/order-status-transitions.js";
import { getZonedComponents } from "../../utils/date.time.util.js";

export function prepareProfileTabData(user) {
  return {
    user,
    editUrl: "/nalog/podesavanja",
  };
}

// Splits the current page of appointments into three visually-separated
// buckets so the user doesn't have to read every single date and work out
// for themselves which are done and which are still coming - "Danas" (today,
// most immediate/actionable), then "Predstojeći" (future, soonest first),
// then "Prošli" (past, most recently completed first). Compared using
// getZonedComponents (Belgrade wall-clock date), not the raw UTC Date or the
// SERVER PROCESS's own local date - the exact class of bug already fixed
// once for manual appointment creation (see date.time.util.js) would
// otherwise put an appointment in the wrong bucket for part of the day.
// Grouping only ever happens within the current page (10 items) - the
// underlying list is still paginated server-side, this doesn't re-fetch or
// re-sort across pages.
function groupAppointmentsByDate(appointments) {
  const todayKey = (() => {
    const t = getZonedComponents(new Date());
    return `${t.year}-${t.month}-${t.day}`;
  })();

  const danas = [];
  const predstojeci = [];
  const prosli = [];

  for (const appointment of appointments) {
    if (!appointment.startTimeRaw) {
      predstojeci.push(appointment); // no date to compare - safest bucket, doesn't imply it already happened
      continue;
    }
    const z = getZonedComponents(appointment.startTimeRaw);
    const key = `${z.year}-${z.month}-${z.day}`;
    if (key === todayKey) danas.push(appointment);
    else if (appointment.startTimeRaw > new Date()) predstojeci.push(appointment);
    else prosli.push(appointment);
  }

  // the underlying query already sorts startTime descending (furthest-future
  // first) - reversed here for "danas"/"predstojeci" so what's happening
  // SOONEST reads first, which is what actually matters when something is
  // still ahead of you; "prosli" keeps the descending order as-is (most
  // recently completed first is the more useful default for history)
  danas.reverse();
  predstojeci.reverse();

  return { danas, predstojeci, prosli };
}

export function prepareAppointmentTabData(result, query = {}) {
  return {
    appointments: result.data,
    groups: groupAppointmentsByDate(result.data),
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/nalog/termini",
      query,
    },
    // matched against each filter option's `value` in the view so the
    // dropdown actually shows what's currently applied (<option selected>) -
    // without this the <select> always visually resets to its first option
    // ("Svi") regardless of the real query.status, so re-picking "Svi" to
    // clear an active filter never fires a change event and the form never
    // resubmits, leaving the user stuck on the filtered view
    selectedStatus: query.status || "",
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