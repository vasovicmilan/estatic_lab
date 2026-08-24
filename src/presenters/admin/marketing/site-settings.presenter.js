export function prepareSiteSettingsFormData(settings) {
  const values = settings || {};
  const hero = values.hero || {};
  const policy = values.bookingPolicy || {};
  const currency = values.currency || {};

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

  return {
    formAction: "/admin/sajt",
    formEnctype: "multipart/form-data",
    isEdit: true,
    fields,
    submitLabel: "Sačuvaj izmene",
    cancelUrl: "/admin",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Sadržaj sajta", url: null },
    ],
  };
}

export default { prepareSiteSettingsFormData };