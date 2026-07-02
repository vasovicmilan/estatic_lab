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
      basePath: "/moji-termini",
      query,
    },
    filters: [
      { value: "", label: "Svi" },
      { value: "pending", label: "Na čekanju" },
      { value: "confirmed", label: "Potvrđeno" },
      { value: "completed", label: "Završeno" },
    ],
  };
}

export function prepareEmployeeAppointmentDetailData(appointment) {
  return {
    appointment,
    canConfirm: appointment.status === "Na čekanju",
    canReject: appointment.status === "Na čekanju",
    canComplete: appointment.status === "Potvrđeno",
    backUrl: "/moji-termini",
  };
}

export function prepareEmployeeProfileTabData(employee) {
  return {
    employee,
    workingHoursEditUrl: "/moj-profil/radno-vreme",
  };
}