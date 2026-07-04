// Step 1: service + variant selection
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

// Step 2: date/employee selection + available slots (slots come pre-computed from the
// availability service — this presenter only arranges them for the calendar widget)
export function prepareBookingSlotsStepData(service, variant, { date, employees = [], slots = [] } = {}) {
  return {
    service,
    variant,
    step: 2,
    date,
    employees, // includes an "Nema preferenciju" / system-assign option, added by the controller
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

// Step 3: contact details (only shown if not logged in) + confirmation
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

// Step 4: confirmation screen after successful booking
export function prepareBookingConfirmationData(appointment, { accountJustCreated = false } = {}) {
  return {
    appointment,
    accountJustCreated, // true when a guest User was auto-created — prompts a "claim your account" banner
    breadcrumbs: [{ label: "Termin zakazan", url: null }],
  };
}
