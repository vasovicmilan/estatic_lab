import { DAYS_OF_WEEK } from "../../../utils/working-hours.util.js";

const DAY_LABELS = {
  monday: "Ponedeljak",
  tuesday: "Utorak",
  wednesday: "Sreda",
  thursday: "Četvrtak",
  friday: "Petak",
  saturday: "Subota",
  sunday: "Nedelja",
};

function translateDay(day) {
  return DAY_LABELS[day] || day;
}

// Unconfigured default shown when the singleton document somehow has no
// workingHours yet (shouldn't happen in practice - site-settings.model.js's
// schema always supplies defaultWorkingHours() - but mirrors it here anyway
// so this presenter never crashes indexing into an empty array) - same
// "every day isOpen:false" shape as the model default.
function defaultWorkingHoursValue() {
  return DAYS_OF_WEEK.map((day) => ({ day, isOpen: false, from: "09:00", to: "20:00" }));
}

// site-settings.service.js's getSiteSettingsForEdit hands back `date` as a
// real Date instance (straight off the Mongoose subdocument, not a
// pre-serialized string) - String(aDateInstance) gives its verbose
// toString() form ("Wed Jan 01 2026 00:00:00 GMT+0000 (...)"), not an ISO
// string, so slicing THAT to 10 chars would silently produce garbage
// ("Wed Jan 0") instead of "2026-01-01". Handles a plain string too (in case
// this is ever called with an already-serialized value, e.g. re-rendering
// req.body after a validation error) for the same reason coupon.presenter.js
// guards its own date fields with `String(...).slice(0, 10)`.
function toDateInputValue(date) {
  if (!date) return "";
  if (date instanceof Date) return isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  return String(date).slice(0, 10);
}

export function prepareSiteSettingsFormData(settings) {
  const values = settings || {};
  const hero = values.hero || {};
  const policy = values.bookingPolicy || {};
  const currency = values.currency || {};
  const commissionPolicy = values.commissionPolicy || {};

  const fields = [
    {
      name: "heroImage",
      label: "Hero slika (naslovna slika početne strane)",
      type: "file",
      accept: "image/*",
      required: false,
      width: 6,
      preview: hero.image || null,
      help: "Preporučena širina: 1600px. Ako se ne izabere nova slika, zadržava se postojeća.",
    },
    {
      name: "heroImageAlt",
      label: "Opis slike (alt tekst)",
      type: "text",
      width: 6,
      required: false,
      value: hero.imageAlt || "",
    },

    // ---- Politika zakazivanja ----
    // Was hardcoded in config/booking.config.js - see runtime-settings.cache.js
    // for why this is safe to edit live (no restart needed, takes effect on
    // the next request via site-settings.controller.js's refresh).
    {
      sectionTitle: "Politika zakazivanja",
      name: "bufferMinutes",
      label: "Razmak između termina (minuti)",
      type: "number",
      width: 6,
      required: true,
      value: policy.bufferMinutes,
      help: "Vreme rezervisano pre i posle svakog termina za pripremu/čišćenje.",
    },
    {
      name: "slotGridMinutes",
      label: "Korak ponuđenih termina (minuti)",
      type: "number",
      width: 6,
      required: true,
      value: policy.slotGridMinutes,
      help: "Npr. 30 → termini se nude na 09:00, 09:30, 10:00...",
    },
    {
      name: "userCancellationCutoffHours",
      label: "Rok za samostalno otkazivanje (sati)",
      type: "number",
      width: 6,
      required: true,
      value: policy.userCancellationCutoffHours,
      help: "Koliko sati unapred klijent sme sam da otkaže termin.",
    },
    {
      name: "rescheduleMinLeadMinutes",
      label: "Minimalna najava za novo vreme (minuti)",
      type: "number",
      width: 6,
      required: true,
      value: policy.rescheduleMinLeadMinutes,
    },
    {
      name: "rescheduleSameDayFloorHours",
      label: "Prag za pomeranje - samo isti dan (sati)",
      type: "number",
      width: 6,
      required: true,
      value: policy.rescheduleSameDayFloorHours,
      help: "Ispod ovog broja sati, termin se uopšte ne može pomeriti (osim od strane admina).",
    },
    {
      name: "rescheduleCutoffHours",
      label: "Prag za slobodno pomeranje (sati)",
      type: "number",
      width: 6,
      required: true,
      value: policy.rescheduleCutoffHours,
      help: "Iznad ovog broja sati, termin se može pomeriti na bilo koji dan/vreme.",
    },

    // ---- Provizija ----
    // See commission.service.js's own comment on recordAppointmentCommissions
    // for exactly where this applies: a package-covered appointment's employee
    // commission, AND a manually-created appointment (walk-in gift, nagrada,
    // poklon) with an admin-set price override - guaranteeing at least this
    // much even when the package/price was sniženo/promotivno or given away
    // entirely (0 RSD). An ordinary a-la-carte appointment (self-booked, at
    // the normal catalog price, optionally with a coupon) is never affected
    // by this setting.
    {
      sectionTitle: "Provizija",
      name: "minimumSessionCommission",
      label: "Minimalna provizija po seansi iz paketa ili ručno kreiranog termina (RSD)",
      type: "number",
      width: 6,
      required: true,
      min: 0,
      value: commissionPolicy.minimumSessionCommission,
      help: "Garantovan minimum za zaposlenog na proviziji kada je termin plaćen iz paketa prodatog po sniženoj/promotivnoj ceni ili poklonjenog (0 RSD), ili kada je termin ručno kreiran sa ručno podešenom cenom (poklon, nagrada i slično) - štiti od toga da niska/nulta cena obračuna proviziju na skoro ništa.",
    },

    // ---- Valuta ----
    // Display-only (see currency.util.js) - ne menja podatke u bazi, samo
    // kako se cena prikazuje.
    {
      sectionTitle: "Valuta",
      name: "currencyCode",
      label: "Kod valute",
      type: "text",
      width: 4,
      required: true,
      value: currency.code || "RSD",
      help: "Npr. RSD, EUR, USD.",
    },
    {
      name: "currencySymbol",
      label: "Simbol/oznaka za prikaz",
      type: "text",
      width: 4,
      required: true,
      value: currency.symbol || "RSD",
      help: "Npr. RSD, €, $.",
    },
    {
      name: "currencySymbolPosition",
      label: "Pozicija oznake",
      type: "select",
      width: 4,
      required: true,
      value: currency.symbolPosition || "after",
      options: [
        { value: "after", label: "Posle iznosa (100 RSD)" },
        { value: "before", label: "Pre iznosa ($100)" },
      ],
    },
  ];

  // ---- Radno vreme (prikaz na sajtu) ----
  // Rendered as its OWN <form> (posting to /admin/sajt/radno-vreme, a
  // different route/controller action than the fields above) - deliberately
  // kept OUT of the `fields` array above, which drives the single generic
  // <form> admin/_form.ejs renders. See site-settings.ejs for why this page
  // needed a dedicated, hand-authored view instead of the generic one every
  // other admin/_form.ejs-driven page uses (in short: three independent
  // <form>s on one page, and admin/_form.ejs only ever renders one).
  //
  // Fixed 7-row shape (never add/remove a day, unlike Employee.workingHours'
  // "schedule" field type) - see site-settings.model.js's WorkingHoursDaySchema
  // and admin-day-hours.js for the client-side counterpart of this "day-hours"
  // field type.
  const workingHoursField = {
    name: "workingHours",
    label: "Radno vreme (prikaz na sajtu)",
    type: "day-hours",
    days: DAYS_OF_WEEK.map((d) => ({ value: d, label: translateDay(d) })),
    value: values.workingHours && values.workingHours.length === 7 ? values.workingHours : defaultWorkingHoursValue(),
    help: "Ovo je INFORMATIVNI raspored prikazan posetiocima (kontakt strana, footer, SEO) - ne utiče na to koji termini se mogu zakazati (to i dalje zavisi od radnog vremena svakog zaposlenog).",
  };

  // ---- Neradni dani / praznici ----
  // Also its own <form> (posting to /admin/sajt/neradni-dani). Reuses the
  // existing generic "repeater" field type/admin-repeater.js as-is - this
  // shape (a variable-length list of {date, reason, recurringYearly} rows) is
  // exactly what that widget was already built for.
  const closedDatesField = {
    name: "closedDates",
    label: "Neradni dani / praznici",
    type: "repeater",
    addLabel: "Dodaj neradni dan",
    itemFields: [
      { name: "date", label: "Datum", type: "date", required: true },
      { name: "reason", label: "Razlog (opciono)", type: "text" },
      { name: "recurringYearly", label: "Ponavlja se svake godine", type: "checkbox" },
    ],
    // A repeater's "date" subfield renders as a plain <input type="date">
    // (admin-repeater.js's default branch), which only accepts/pre-fills a
    // bare "YYYY-MM-DD" string - NOT a Date object's default toString(). The
    // stored value (site-settings.service.js's updateClosedDates always saves
    // a real Date) has to be re-formatted here the same way
    // coupon.presenter.js's own validFrom/validUntil date fields already do,
    // or every existing row would silently render with an empty date picker.
    value: (values.closedDates || []).map((cd) => ({
      date: toDateInputValue(cd.date),
      reason: cd.reason || "",
      recurringYearly: !!cd.recurringYearly,
    })),
    help: "Ovi datumi blokiraju ZAKAZIVANJE za sve zaposlene (praznik, kolektivni godišnji odmor...), bez obzira na nečije lično radno vreme.",
  };

  return {
    formAction: "/admin/sajt",
    formEnctype: "multipart/form-data",
    isEdit: true,
    fields,
    submitLabel: "Sačuvaj izmene",
    cancelUrl: "/admin",
    workingHoursField,
    workingHoursFormAction: "/admin/sajt/radno-vreme",
    closedDatesField,
    closedDatesFormAction: "/admin/sajt/neradni-dani",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Sadržaj sajta", url: null },
    ],
  };
}

export default { prepareSiteSettingsFormData };