import { canUserCancelAppointment } from "../../utils/appointment-cancellation.util.js";

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
  return {
    appointment,
    canCancel: canUserCancelAppointment(appointment.statusRaw, appointment.termin?.pocetakRaw),
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