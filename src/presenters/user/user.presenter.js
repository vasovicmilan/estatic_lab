import { canUserCancelAppointment, getRescheduleWindow } from "../../utils/appointment-cancellation.util.js";
import { canUserCancelOrder } from "../../models/order-status-transitions.js";
import { getZonedComponents } from "../../utils/date.time.util.js";

export function prepareProfileTabData(user) {
  return {
    user,
    editUrl: "/nalog/podesavanja",
  };
}

// Splits the "upcoming" list (today onward - see user.controller.js's own
// appointments(), which queries it separately from "past") into "Danas"
// (today, most immediate/actionable) and "Predstojeći" (everything after
// today) for display. Compared using getZonedComponents (Belgrade
// wall-clock date), not the raw UTC Date or the SERVER PROCESS's own local
// date - the exact class of bug already fixed once for manual appointment
// creation (see date.time.util.js) would otherwise put an appointment in
// the wrong bucket for part of the day.
function splitUpcomingByToday(appointments) {
  const todayKey = (() => {
    const t = getZonedComponents(new Date());
    return `${t.year}-${t.month}-${t.day}`;
  })();

  const danas = [];
  const predstojeci = [];

  for (const appointment of appointments) {
    if (!appointment.startTimeRaw) {
      predstojeci.push(appointment); // no date to compare - safest bucket, doesn't imply it's today
      continue;
    }
    const z = getZonedComponents(appointment.startTimeRaw);
    const key = `${z.year}-${z.month}-${z.day}`;
    if (key === todayKey) danas.push(appointment);
    else predstojeci.push(appointment);
  }

  return { danas, predstojeci };
}

export function prepareAppointmentTabData({ upcoming, past }, query = {}) {
  const { danas, predstojeci } = splitUpcomingByToday(upcoming.data);

  // status/the OTHER section's own page are carried through in `query` so
  // paging through "Predstojeći" doesn't reset "Prošli" back to its first
  // page (and vice versa) - each section reads its own pageParam
  // (upcomingPage/pastPage), see includes/pagination.ejs's own support for that
  const sharedQuery = { status: query.status || "" };

  return {
    appointments: [...upcoming.data, ...past.data],
    groups: { danas, predstojeci, prosli: past.data },
    paginationUpcoming: {
      currentPage: upcoming.page,
      totalPages: upcoming.totalPages,
      basePath: "/nalog/termini",
      pageParam: "upcomingPage",
      query: { ...sharedQuery, pastPage: query.pastPage || "" },
    },
    paginationPast: {
      currentPage: past.page,
      totalPages: past.totalPages,
      basePath: "/nalog/termini",
      pageParam: "pastPage",
      query: { ...sharedQuery, upcomingPage: query.upcomingPage || "" },
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