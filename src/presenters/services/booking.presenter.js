export function prepareBookingServiceStepData(service) {
  return {
    service,
    step: 1,
    nextUrl: `/zakazivanje/${service.slug}/termin`,
    breadcrumbs: [
      { label: "Usluge", url: "/usluge" },
      { label: service.naziv, url: `/usluge/${service.slug}` },
      { label: "Zakazivanje", url: null },
    ],
  };
}

export function prepareBookingSlotsStepData(service, variant, { date, employees = [], slots = [] } = {}) {
  return {
    service,
    variant,
    step: 2,
    date,
    employees,
    slots: slots.map((s) => ({
      pocetak: s.startTime,
      kraj: s.endTime,
      terapeutId: s.employeeId || null,
    })),
    backUrl: `/usluge/${service.slug}`,
    breadcrumbs: [
      { label: "Usluge", url: "/usluge" },
      { label: service.naziv, url: `/usluge/${service.slug}` },
      { label: "Izbor termina", url: null },
    ],
  };
}

export function prepareBookingContactStepData(service, variant, slot, { isLoggedIn = false, user = null, errors = {} } = {}) {
  return {
    service,
    variant,
    slot,
    step: 3,
    isLoggedIn,
    prefill: isLoggedIn
      ? { firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.telefon || "" }
      : { firstName: "", lastName: "", email: "", phone: "" },
    errors,
    couponFieldEnabled: true,
    breadcrumbs: [
      { label: "Usluge", url: "/usluge" },
      { label: service.naziv, url: `/usluge/${service.slug}` },
      { label: "Podaci za kontakt", url: null },
    ],
  };
}

export function prepareBookingConfirmationData(appointment, { accountJustCreated = false } = {}) {
  return {
    appointment,
    accountJustCreated,
    breadcrumbs: [{ label: "Termin zakazan", url: null }],
  };
}