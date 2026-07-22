export function preparePartnerListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "imePrezime", label: "Ime i prezime" },
      { key: "email", label: "Email" },
      { key: "procenatProvizije", label: "Procenat provizije" },
      { key: "aktivan", label: "Aktivan" },
      { key: "kreiran", label: "Kreiran" },
    ],
    actions: [
      { type: "view", url: "/admin/partneri/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/partneri/izmena/", icon: "pencil" },
      { type: "delete", url: "/admin/partneri/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/partneri",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Partneri", url: null },
    ],
    topbar: {
      createUrl: "/admin/partneri/dodavanje",
      createLabel: "Novi partner",
      searchUrl: "/admin/partneri/pretraga",
      search: query.search || "",
      filters: [
        {
          type: "select",
          name: "isActive",
          label: "Status",
          value: query.isActive || "",
          options: [
            { value: "", label: "Svi" },
            { value: "true", label: "Aktivni" },
            { value: "false", label: "Neaktivni" },
          ],
        },
      ],
    },
  };
}

export function preparePartnerDetailsData(partner, balance = null, coupons = [], commissions = []) {
  return {
    backUrl: "/admin/partneri",
    editUrl: `/admin/partneri/izmena/${partner.id}`,
    sections: [
      {
        title: "Podaci o korisniku",
        type: "table",
        rows: [
          { label: "Ime i prezime", value: partner.korisnik.imePrezime },
          { label: "Email", value: partner.korisnik.email },
          { label: "Telefon", value: partner.korisnik.telefon || "-" },
        ],
      },
      {
        title: "Referalni kodovi",
        type: "table",
        rows:
          coupons.length > 0
            ? coupons.map((c) => ({
                label: c.code,
                value: `${c.discountType === "percentage" ? c.discountValue + "%" : c.discountValue + " RSD"} popust${
                  c.isActive ? "" : " (neaktivan)"
                } - <a href="/admin/kuponi/detalji/${c.id}">detalji</a>`,
              }))
            : [{ label: "Nema dodeljenih kodova", value: `<a href="/admin/kuponi/dodavanje">Kreiraj kupon za ovog partnera</a>` }],
      },
      {
        title: "Poslednje provizije",
        type: "table",
        rows:
          commissions.length > 0
            ? commissions.map((c) => ({
                label: `${c.sourceType === "appointment" ? "Termin" : "Porudžbina"} - ${c.baseValue} RSD x ${c.rate}%`,
                value: `${c.amount} RSD (${translateCommissionStatus(c.status)})`,
              }))
            : [{ label: "Nema zabeleženih provizija", value: "-" }],
      },
    ],
    sidebar: [
      {
        title: "Status",
        type: "table",
        rows: [
          { label: "Procenat provizije", value: partner.procenatProvizije },
          { label: "Aktivan", value: partner.aktivan },
          { label: "Napomena", value: partner.napomena || "-" },
        ],
      },
      ...(balance
        ? [
            {
              title: "Stanje",
              type: "table",
              rows: [
                { label: "Ukupno zarađeno", value: `${balance.earned} RSD` },
                { label: "Isplaćeno", value: `${balance.paid} RSD` },
                { label: "Rezervisano (na čekanju)", value: `${balance.reserved} RSD` },
                { label: "Raspoloživo za isplatu", value: `${balance.available} RSD` },
              ],
            },
            {
              title: "Zabeleži isplatu",
              type: "custom",
              content: "payout-record-form",
              data: { earnerType: "partner", earnerId: partner.id, available: balance.available },
            },
            {
              title: "Sve isplate",
              type: "table",
              rows: [{ label: "Istorija isplata", value: `<a href="/admin/isplate?partnerId=${partner.id}">Pogledaj sve isplate</a>` }],
            },
          ]
        : []),
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreiran", value: partner.vreme.kreiran },
          { label: "Ažuriran", value: partner.vreme.azuriran },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Partneri", url: "/admin/partneri" },
      { label: partner.korisnik.imePrezime, url: null },
    ],
  };
}

function translateCommissionStatus(status) {
  const map = { pending: "Na čekanju", earned: "Zarađeno", reversed: "Stornirano" };
  return map[status] || status;
}

export function preparePartnerFormData(partner = null, { userOptions = [] } = {}) {
  const isEdit = !!partner;
  const values = isEdit ? partner : { userId: "", commissionRate: "", isActive: true, notes: "" };

  const fields = [];

  if (!isEdit) {
    fields.push({
      name: "userId",
      label: "Korisnik",
      type: "select",
      required: true,
      width: 12,
      value: values.userId,
      options: userOptions,
      help: "Postojeći korisnički nalog koji se promoviše u partnera.",
    });
  }

  fields.push(
    {
      name: "commissionRate",
      label: "Procenat provizije",
      type: "number",
      required: true,
      min: 0,
      max: 100,
      step: "0.01",
      width: 6,
      value: values.commissionRate,
      help: "Procenat od diskontovane vrednosti prodaje koji partner dobija kao proviziju.",
    },
    { name: "notes", label: "Napomena", type: "textarea", rows: 3, width: 12, value: values.notes, help: "Najviše 500 karaktera." },
    { name: "isActive", label: "Aktivan", type: "checkbox", width: 6, value: values.isActive }
  );

  return {
    formAction: isEdit ? `/admin/partneri/${partner.id}` : "/admin/partneri",
    isEdit,
    fields,
    submitLabel: isEdit ? "Sačuvaj izmene" : "Kreiraj profil partnera",
    cancelUrl: "/admin/partneri",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Partneri", url: "/admin/partneri" },
      { label: isEdit ? "Izmena" : "Novi partner", url: null },
    ],
  };
}