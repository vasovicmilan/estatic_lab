export function prepareEmployeeDashboardData({ todayAppointments = [], pendingCount = 0, weekAppointments = [] } = {}) {
  return {
    todayAppointments,
    pendingCount,
    weekAppointments,
  };
}

export function prepareEmployeeAppointmentTabData(result, query = {}) {
  return {
    appointments: result.data,
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/moj-nalog/termini",
      query,
    },
    filters: [
      { value: "", label: "Svi" },
      { value: "pending", label: "Na čekanju" },
      { value: "confirmed", label: "Potvrđeno" },
      { value: "completed", label: "Završeno" },
      { value: "no_show", label: "Nije se pojavio/la" },
    ],
  };
}

export function prepareEmployeeAppointmentDetailData(appointment) {
  return {
    appointment,
    canConfirm: appointment.status === "Na čekanju",
    canReject: appointment.status === "Na čekanju",
    canComplete: appointment.status === "Potvrđeno",
    canNoShow: appointment.status === "Potvrđeno",
    backUrl: "/moj-nalog/termini",
  };
}

const SCHEDULE_DAYS = [
  { value: "monday", label: "Ponedeljak" },
  { value: "tuesday", label: "Utorak" },
  { value: "wednesday", label: "Sreda" },
  { value: "thursday", label: "Četvrtak" },
  { value: "friday", label: "Petak" },
  { value: "saturday", label: "Subota" },
  { value: "sunday", label: "Nedelja" },
];

export function prepareEmployeeProfileTabData(employee) {
  return {
    employee,
    workingHoursEditUrl: "/moj-nalog/profil/radno-vreme",
    scheduleDays: SCHEDULE_DAYS,
  };
}