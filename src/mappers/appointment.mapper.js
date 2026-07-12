import { formatDateTime } from "../utils/date.time.util.js";
import { decryptPhone } from "../utils/phone.util.js";

function translateStatus(status) {
  const map = {
    pending: "Na čekanju",
    confirmed: "Potvrđeno",
    rejected: "Odbijeno",
    cancelled: "Otkazano",
    completed: "Završeno",
    no_show: "Nije se pojavio/la",
  };
  return map[status] || status;
}

function translateActor(actor) {
  const map = {
    system: "Sistem",
    admin: "Administrator",
    employee: "Terapeut",
    user: "Korisnik",
  };
  return map[actor] || actor;
}

function getUserName(appointment) {
  if (appointment.contactSnapshot?.firstName) {
    return `${appointment.contactSnapshot.firstName} ${appointment.contactSnapshot.lastName || ""}`.trim();
  }
  if (appointment.user && typeof appointment.user === "object") {
    return `${appointment.user.firstName || ""} ${appointment.user.lastName || ""}`.trim();
  }
  return "Nepoznat korisnik";
}

function getUserEmail(appointment) {
  if (appointment.contactSnapshot?.email) return appointment.contactSnapshot.email;
  if (appointment.user && typeof appointment.user === "object") return appointment.user.email;
  return null;
}

function getUserPhone(appointment) {
  if (appointment.contactSnapshot?.phone) return appointment.contactSnapshot.phone;
  if (appointment.user && typeof appointment.user === "object") return decryptPhone(appointment.user.phone);
  return null;
}

function getEmployeeName(employeeDoc) {
  if (!employeeDoc) return null;
  if (typeof employeeDoc === "object" && employeeDoc.userId) {
    const user = employeeDoc.userId;
    if (user && typeof user === "object") {
      return `${user.firstName || ""} ${user.lastName || ""}`.trim();
    }
  }
  return employeeDoc._id?.toString() || employeeDoc.toString?.() || "Nepoznat";
}

export function mapAppointmentForAdminShort(appointment) {
  return {
    id: appointment._id.toString(),
    korisnik: getUserName(appointment),
    usluga: appointment.variant?.name || appointment.service?.name || "Nepoznato",
    datum: formatDateTime(appointment.startTime),
    status: translateStatus(appointment.status),
    statusRaw: appointment.status,
    konacnaCena: appointment.finalPrice != null ? `${appointment.finalPrice.toFixed(2)} RSD` : "0 RSD",
  };
}

export function mapAppointmentsForAdminList(appointments = []) {
  return appointments.map(mapAppointmentForAdminShort).filter(Boolean);
}

export function mapAppointmentForAdminDetail(appointment) {
  return {
    id: appointment._id.toString(),
    korisnik: {
      ime: getUserName(appointment),
      email: getUserEmail(appointment),
      telefon: getUserPhone(appointment),
    },
    usluga: {
      naziv: appointment.variant?.name || appointment.service?.name,
      trajanje: appointment.variant?.duration ? `${appointment.variant.duration} min` : null,
      cena: appointment.variant?.price != null ? `${appointment.variant.price.toFixed(2)} RSD` : null,
    },
    termin: {
      pocetak: formatDateTime(appointment.startTime),
      kraj: formatDateTime(appointment.endTime),
    },
    status: translateStatus(appointment.status),
    statusRaw: appointment.status,
    terapeut: appointment.employee ? getEmployeeName(appointment.employee) : null,
    dodeljenTerapeut: appointment.assignedTo ? getEmployeeName(appointment.assignedTo) : null,
    napomena: appointment.note || null,
    popust: appointment.discountApplied ? `${appointment.discountApplied} RSD` : null,
    konacnaCena: appointment.finalPrice != null ? `${appointment.finalPrice.toFixed(2)} RSD` : null,
    kupon: appointment.coupon?.code || null,

    odbio: appointment.rejectedBy ? translateActor(appointment.rejectedBy) : null,
    odbijenU: formatDateTime(appointment.rejectedAt),
    razlogOdbijanja: appointment.rejectionReason || null,

    oznacioNeDosao: appointment.noShowBy ? translateActor(appointment.noShowBy) : null,
    neDosaoU: formatDateTime(appointment.noShowAt),
    napomenaNeDosao: appointment.noShowNote || null,

    potvrdio: appointment.confirmedBy ? translateActor(appointment.confirmedBy) : null,
    potvrdjenU: formatDateTime(appointment.confirmedAt),

    dodelio: appointment.assignedBy ? translateActor(appointment.assignedBy) : null,
    dodeljenU: formatDateTime(appointment.assignedAt),

    otkazao: appointment.cancelledBy ? translateActor(appointment.cancelledBy) : null,
    otkazanU: formatDateTime(appointment.cancelledAt),
    razlogOtkazivanja: appointment.cancellationReason || null,

    createdAt: formatDateTime(appointment.createdAt),
    updatedAt: formatDateTime(appointment.updatedAt),
  };
}

export function mapAppointmentForEmployeeShort(appointment) {
  return {
    id: appointment._id.toString(),
    klijent: getUserName(appointment),
    usluga: appointment.variant?.name || appointment.service?.name,
    datum: formatDateTime(appointment.startTime),
    status: translateStatus(appointment.status),
    cena: appointment.finalPrice != null ? `${appointment.finalPrice.toFixed(2)} RSD` : null,
  };
}

export function mapAppointmentForEmployeeDetail(appointment) {
  return {
    id: appointment._id.toString(),
    klijent: {
      ime: getUserName(appointment),
      email: getUserEmail(appointment),
      telefon: getUserPhone(appointment),
    },
    usluga: {
      naziv: appointment.variant?.name,
      trajanje: appointment.variant?.duration ? `${appointment.variant.duration} min` : null,
      cena: appointment.variant?.price != null ? `${appointment.variant.price.toFixed(2)} RSD` : null,
    },
    termin: {
      pocetak: formatDateTime(appointment.startTime),
      kraj: formatDateTime(appointment.endTime),
    },
    status: translateStatus(appointment.status),
    napomenaKlijenta: appointment.note || null,
    konacnaCena: appointment.finalPrice != null ? `${appointment.finalPrice.toFixed(2)} RSD` : null,
    mojaUloga:
      appointment.employee?._id?.toString() === appointment.assignedTo?._id?.toString()
        ? "Direktno zakazan"
        : "Dodeljen od strane sistema",
  };
}

export function mapAppointmentForUserShort(appointment) {
  return {
    id: appointment._id.toString(),
    usluga: appointment.variant?.name || appointment.service?.name,
    datum: formatDateTime(appointment.startTime),
    status: translateStatus(appointment.status),
    cena: appointment.finalPrice != null ? `${appointment.finalPrice.toFixed(2)} RSD` : null,
  };
}

export function mapAppointmentForUserDetail(appointment) {
  return {
    id: appointment._id.toString(),
    usluga: {
      naziv: appointment.variant?.name,
      trajanje: appointment.variant?.duration ? `${appointment.variant.duration} min` : null,
      cena: appointment.variant?.price != null ? `${appointment.variant.price.toFixed(2)} RSD` : null,
    },
    termin: {
      pocetak: formatDateTime(appointment.startTime),
      kraj: formatDateTime(appointment.endTime),
    },
    status: translateStatus(appointment.status),
    terapeut: appointment.employee
      ? getEmployeeName(appointment.employee)
      : appointment.assignedTo
      ? getEmployeeName(appointment.assignedTo)
      : "Nije dodeljen",
    napomena: appointment.note || null,
    popust: appointment.discountApplied ? `${appointment.discountApplied} RSD` : null,
    konacnaCena: appointment.finalPrice != null ? `${appointment.finalPrice.toFixed(2)} RSD` : null,
    kupon: appointment.coupon?.code || null,
    createdAt: formatDateTime(appointment.createdAt),

    razlogOdbijanja: appointment.status === "rejected" ? appointment.rejectionReason || "Nije naveden" : null,
    razlogOtkazivanja: appointment.status === "cancelled" ? appointment.cancellationReason || null : null,
  };
}

// public availability calendar — zero personal data, just occupied slots
export function mapAppointmentForPublicCalendar(appointment) {
  if (!appointment) return null;
  return {
    pocetak: appointment.startTime,
    kraj: appointment.endTime,
    terapeutId: appointment.employee?.toString() || appointment.assignedTo?.toString() || null,
  };
}

export function mapAppointmentRaw(appointment) {
  return appointment;
}

/**
 * Dispatcher used by appointment.service.js — picks the right shape by who's asking.
 */
export function mapAppointment(appointment, role, viewType = "short") {
  if (!appointment) return null;
  if (role === "admin") {
    return viewType === "short" ? mapAppointmentForAdminShort(appointment) : mapAppointmentForAdminDetail(appointment);
  }
  if (role === "employee") {
    return viewType === "short"
      ? mapAppointmentForEmployeeShort(appointment)
      : mapAppointmentForEmployeeDetail(appointment);
  }
  // user ili guest
  return viewType === "short" ? mapAppointmentForUserShort(appointment) : mapAppointmentForUserDetail(appointment);
}

export default {
  mapAppointmentForAdminShort,
  mapAppointmentsForAdminList,
  mapAppointmentForAdminDetail,
  mapAppointmentForEmployeeShort,
  mapAppointmentForEmployeeDetail,
  mapAppointmentForUserShort,
  mapAppointmentForUserDetail,
  mapAppointmentForPublicCalendar,
  mapAppointmentRaw,
  mapAppointment,
};