export function prepareManualAppointmentFormData({ services = [], employeesByService = {}, userOptions = [] } = {}) {
  return {
    services,
    employeesByService,
    userOptions,
    formAction: "/admin/termini/rucno-kreiranje",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Termini", url: "/admin/termini" },
      { label: "Novi termin (ručno)", url: null },
    ],
    cancelUrl: "/admin/termini",
  };
}

export default { prepareManualAppointmentFormData };