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
export function prepareBookingSlotsStepData(service, variant, { date, employeeId = "", employees = [], slots = [] } = {}) {
  return {
    service,
    variant,
    step: 2,
    date,
    employeeId,
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

// Step 3: contact details (only shown if not logged in) + confirmation
export function prepareBookingContactStepData(
  service,
  variant,
  slot,
  { isLoggedIn = false, user = null, errors = {}, usablePackagePurchase = null } = {}
) {
  // usablePackagePurchase is a raw (lean) PackagePurchase doc from
  // package-purchase.service.js's findUsablePurchaseForService — only ever passed
  // when isLoggedIn, since a package purchase belongs to a real account. Trimmed
  // down here to just what the contact-step view needs to render the "pay with my
  // package" option; the actual authorization check happens again server-side in
  // appointmentService.bookAppointment() regardless of what this suggests.
  const packageOption = usablePackagePurchase
    ? (() => {
        const item = usablePackagePurchase.items.find((i) => String(i.servicePackageId) === String(variant.id));
        return {
          id: usablePackagePurchase._id.toString(),
          preostaloSeansi: item ? item.sessionsTotal - item.sessionsUsed - (item.sessionsReserved || 0) : 0,
        };
      })()
    : null;

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
    // a package-covered booking is already prepaid — the coupon field only makes
    // sense when the visitor is actually paying for this booking
    couponFieldEnabled: true,
    usablePackagePurchase: packageOption,
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

export default {
  prepareBookingServiceStepData,
  prepareBookingSlotsStepData,
  prepareBookingContactStepData,
  prepareBookingConfirmationData,
};