import { formatPrice, formatMoney } from "../../../utils/price.util.js";
import { translateCommissionSourceType, translateCommissionStatus } from "../../../utils/commission-display.util.js";

export function preparePartnerListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "imePrezime", label: "Ime i prezime" },
      { key: "email", label: "Email" },
      { key: "procenatProvizijeUsluge", label: "Provizija - usluge/paketi" },
      { key: "procenatProvizijeArtikli", label: "Provizija - artikli" },
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
                value: `${c.discountType === "percentage" ? c.discountValue + "%" : formatMoney(c.discountValue)} popust${
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
                label: `${translateCommissionSourceType(c.sourceType)} - ${formatMoney(c.baseValue)} x ${c.rate}%`,
                value: `${formatMoney(c.amount)} (${translateCommissionStatus(c.status)})`,
              }))
            : [{ label: "Nema zabeleženih provizija", value: "-" }],
      },
    ],
    sidebar: [
      {
        title: "Status",
        type: "table",
        rows: [
          { label: "Provizija - usluge/paketi", value: partner.procenatProvizijeUsluge },
          { label: "Provizija - artikli", value: partner.procenatProvizijeArtikli },
          { label: "Max. provizija po transakciji - usluge/paketi", value: partner.maxProvizijaUsluge },
          { label: "Max. provizija po transakciji - artikli", value: partner.maxProvizijaArtikli },
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
                { label: "Ukupno zarađeno", value: formatMoney(balance.earned) },
                { label: "Isplaćeno", value: formatMoney(balance.paid) },
                { label: "Rezervisano (na čekanju)", value: formatMoney(balance.reserved) },
                { label: "Raspoloživo za isplatu", value: formatMoney(balance.available) },
              ],
            },
            {
              title: "Zabeleži isplatu",
              type: "custom",
              content: "payout-record-form",
              data: { earnerType: "partner", earnerId: partner.id, available: formatPrice(balance.available), availableDisplay: formatMoney(balance.available) },
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

export function preparePartnerFormData(partner = null, { userOptions = [] } = {}) {
  const isEdit = !!partner;
  const values = isEdit
    ? partner
    : {
        userId: "",
        commissionRateServices: "",
        commissionRateProducts: "",
        maxCommissionAmountServices: null,
        maxCommissionAmountProducts: null,
        isActive: true,
        notes: "",
      };

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
      name: "commissionRateServices",
      label: "Procenat provizije - usluge i paketi",
      type: "number",
      required: true,
      min: 0,
      max: 100,
      step: "0.01",
      width: 6,
      value: values.commissionRateServices,
      help: "Procenat od diskontovane vrednosti termina/paketa koji partner dobija kao proviziju.",
    },
    {
      name: "commissionRateProducts",
      label: "Procenat provizije - artikli (shop)",
      type: "number",
      required: true,
      min: 0,
      max: 100,
      step: "0.01",
      width: 6,
      value: values.commissionRateProducts,
      help: "Odvojeno od gornje stope - katalog artikala ide od sitnog potrošnog materijala do skupih uređaja, pa ista % stopa retko ima smisla za oboje.",
    },
    {
      name: "maxCommissionAmountServices",
      label: "Maksimalna provizija po transakciji - usluge/paketi u RSD (opciono)",
      type: "number",
      min: 0,
      step: "0.01",
      width: 6,
      value: values.maxCommissionAmountServices,
    },
    {
      name: "maxCommissionAmountProducts",
      label: "Maksimalna provizija po transakciji - artikli u RSD (opciono)",
      type: "number",
      min: 0,
      step: "0.01",
      width: 6,
      value: values.maxCommissionAmountProducts,
      help: "Preporučeno podesiti ako partner ima kupon koji važi i za skuplje uređaje - sprečava da jedna velika porudžbina generiše neproporcionalno visoku proviziju.",
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