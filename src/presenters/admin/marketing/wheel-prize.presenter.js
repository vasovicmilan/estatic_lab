const DISCOUNT_TYPES = [
  { value: "percentage", label: "Procenat (%)" },
  { value: "fixed", label: "Fiksni iznos (RSD)" },
];

/** Form definition for adding / editing a wheel prize; `prize` is the service view of a stored prize. */
export function prepareWheelPrizeFormData(prize = null, { serviceOptions = [] } = {}) {
  const isEdit = !!prize;
  const v = prize || { weight: 10, validDays: 30, isActive: true, discountType: "percentage", serviceSlugs: [], stock: null };
  const locked = !!prize?.isFallback;
  return {
    formAction: isEdit ? `/admin/tocak/nagrade/${prize.id}` : "/admin/tocak/nagrade",
    cancelUrl: "/admin/tocak/nagrade",
    isEdit,
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Točak sreće", url: "/admin/tocak" },
      { label: "Nagrade i QR", url: "/admin/tocak/nagrade" },
      { label: isEdit ? "Izmena nagrade" : "Nova nagrada", url: null },
    ],
    fields: [
      { name: "label", label: "Naziv nagrade", type: "text", width: 8, value: v.label || "", required: true, help: "Pun naziv koji posetilac vidi kad osvoji, npr. „Besplatan ESMA tretman“." },
      { name: "shortLabel", label: "Kratak naziv na točku", type: "text", width: 4, value: v.shortLabel || "", required: true, max: 18, help: "Najviše 18 karaktera, mora da stane na isečak." },
      { sectionTitle: "Popust koji nagrada daje", name: "discountType", label: "Tip popusta", type: "select", width: 4, value: v.discountType, options: DISCOUNT_TYPES },
      { name: "discountValue", label: "Vrednost popusta", type: "number", width: 4, value: v.discountValue ?? "", required: true, min: 1, step: "any", help: "Procenat (1-100) ili iznos u RSD, zavisno od tipa." },
      { name: "maxDiscountAmount", label: "Gornja granica popusta (RSD)", type: "number", width: 4, value: v.maxDiscountAmount ?? "", min: 0, step: "any", help: "Opciono. Ima smisla uz procenat." },
      {
        name: "serviceSlugs",
        label: "Važi za usluge",
        type: "checkbox-group",
        width: 12,
        value: v.serviceSlugs || [],
        options: serviceOptions,
        help: "Ništa izabrano = važi za sve usluge. Izabrane usluge ograničavaju kupon samo na njih (npr. besplatan tretman).",
      },
      { name: "includeProducts", label: "Kupon važi i za kozmetiku (proizvode)", type: "checkbox", width: 12, value: !!v.includeProducts },
      { sectionTitle: "Na točku", name: "weight", label: "Šansa (težina)", type: "number", width: 3, value: v.weight ?? 10, required: true, min: 0, step: "any", help: "Relativna težina: 45 : 25 : 15." },
      { name: "stock", label: "Zaliha", type: "number", width: 3, value: v.stock ?? "", min: 0, step: 1, placeholder: "neograničeno", disabled: locked, help: locked ? "Rezervna nagrada je uvek neograničena." : `Prazno = neograničeno.${isEdit ? ` Već podeljeno: ${v.awardedCount}.` : ""}` },
      { name: "validDays", label: "Rok važenja (dana)", type: "number", width: 3, value: v.validDays ?? 30, required: true, min: 1, max: 365, step: 1 },
      { name: "order", label: "Redosled na točku", type: "number", width: 3, value: v.order ?? "", step: 1, help: "Manji broj ide ranije." },
      { name: "color", label: "Boja isečka", type: "text", width: 4, value: v.color || "", placeholder: "#b08d57", help: "Oblik #rrggbb. Prazno = automatski." },
      { name: "isActive", label: "Aktivna (prikazuje se na točku)", type: "checkbox", width: 4, value: v.isActive !== false },
      { name: "isFallback", label: "Rezervna nagrada (daje se kad ostale nestanu)", type: "checkbox", width: 4, value: !!v.isFallback },
    ],
    submitLabel: isEdit ? "Sačuvaj izmene" : "Dodaj nagradu",
  };
}

export default { prepareWheelPrizeFormData };
