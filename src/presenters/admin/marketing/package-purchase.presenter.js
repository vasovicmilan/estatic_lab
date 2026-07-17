export function preparePackagePurchaseListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "paket", label: "Paket" },
      { key: "cena", label: "Cena" },
      { key: "status", label: "Status" },
      { key: "kupljeno", label: "Kupljeno" },
      { key: "istice", label: "Ističe" },
    ],
    actions: [
      { type: "view", url: "/admin/kupljeni-paketi/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/kupljeni-paketi/izmena/", icon: "pencil" },
      { type: "delete", url: "/admin/kupljeni-paketi/", icon: "trash" },
    ],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/kupljeni-paketi",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Kupljeni paketi", url: null },
    ],
    topbar: {
      createUrl: query.userId ? `/admin/kupljeni-paketi/dodavanje?userId=${query.userId}` : "/admin/kupljeni-paketi/dodavanje",
      createLabel: "Dodeli paket",
      searchUrl: "/admin/kupljeni-paketi/pretraga",
      search: query.search || "",
      filters: [
        {
          type: "select",
          name: "status",
          label: "Status",
          value: query.status || "",
          options: [
            { value: "", label: "Svi" },
            { value: "active", label: "Aktivan" },
            { value: "completed", label: "Iskorišćen" },
            { value: "expired", label: "Istekao" },
            { value: "cancelled", label: "Otkazan" },
          ],
        },
      ],
    },
  };
}

export function preparePackagePurchaseDetailsData(purchase) {
  return {
    backUrl: "/admin/kupljeni-paketi",
    editUrl: `/admin/kupljeni-paketi/izmena/${purchase.id}`,
    sections: [
      {
        title: "Osnovni podaci",
        type: "table",
        rows: [
          { label: "Korisnik", value: purchase.korisnik },
          { label: "Email", value: purchase.korisnikEmail || "-" },
          { label: "Paket", value: purchase.paket },
          { label: "Status", value: purchase.status },
          { label: "Napomena", value: purchase.napomena || "-" },
        ],
      },
      {
        title: "Usluge u paketu",
        type: "table",
        rows: purchase.stavke.map((s) => ({
          label: `${s.usluga} - ${s.varijanta}`,
          value: `${s.iskorisceno} iskorišćeno, ${s.rezervisano} rezervisano / ${s.ukupnoSeansi} ukupno (${s.preostalo} slobodno)`,
        })),
      },
    ],
    sidebar: [
      {
        title: "Cena",
        type: "table",
        rows: [
          { label: "Originalna cena", value: `${purchase.originalnaCena} RSD` },
          { label: "Popust", value: `${purchase.popust} RSD` },
          { label: "Plaćeno", value: `${purchase.placeno} RSD` },
        ],
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kupljeno", value: purchase.vreme.kupljeno },
          { label: "Ističe", value: purchase.vreme.istice },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Kupljeni paketi", url: "/admin/kupljeni-paketi" },
      { label: purchase.paket, url: null },
    ],
  };
}

// `packages` here is the raw admin-list shape from packageService.listPackages()
// (each with .naziv, .stavke [an array of "ServiceName - VariantName xN" strings],
// .cena) - used to build both the plain <select> options AND the live preview data
// keyed by package id, since which variant a package covers is fixed by the Package
// template and can't be chosen at assignment time, only shown.
export function preparePackagePurchaseFormData({ userOptions = [], packages = [], prefillUserId = "" } = {}) {
  const packageOptions = packages.map((p) => ({ value: p.id, label: p.naziv }));
  const packagePreviewData = packages.reduce((acc, p) => {
    acc[p.id] = { cena: p.cena, stavke: p.stavke };
    return acc;
  }, {});

  return {
    formAction: "/admin/kupljeni-paketi",
    formEnctype: "application/x-www-form-urlencoded",
    isEdit: false,
    fields: [
      {
        name: "userId",
        label: "Korisnik",
        type: "select",
        required: true,
        width: 6,
        value: prefillUserId,
        options: userOptions,
      },
      {
        name: "packageId",
        label: "Paket",
        type: "select-preview",
        required: true,
        width: 6,
        options: packageOptions,
        previewData: packagePreviewData,
      },
      { name: "pricePaid", label: "Plaćena cena (opciono - podrazumevano cena paketa)", type: "number", min: 0, step: "0.01", width: 6 },
      { name: "expiresAt", label: "Ističe (opciono - prazno = ne ističe)", type: "date", width: 6 },
      { name: "couponCode", label: "Kupon kod (opciono)", type: "text", width: 6 },
      { name: "notes", label: "Napomena", type: "textarea", rows: 3, width: 12, help: "npr. „plaćeno gotovinom”, „popust 10% dobre volje”" },
    ],
    submitLabel: "Dodeli paket",
    cancelUrl: prefillUserId ? `/admin/korisnici/detalji/${prefillUserId}` : "/admin/kupljeni-paketi",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Kupljeni paketi", url: "/admin/kupljeni-paketi" },
      { label: "Dodeli paket", url: null },
    ],
  };
}

// Deliberately editable fields only: expiresAt/notes. Items, pricing, and the coupon
// used are the actual purchase record and stay immutable - see
// package-purchase.service.js's updatePurchase() for why.
export function preparePackagePurchaseEditFormData(purchase) {
  return {
    formAction: `/admin/kupljeni-paketi/${purchase.id}`,
    formEnctype: "application/x-www-form-urlencoded",
    isEdit: true,
    fields: [
      { name: "expiresAt", label: "Ističe (prazno = ne ističe)", type: "date", width: 6, value: purchase.expiresAtRaw || "" },
      { name: "notes", label: "Napomena", type: "textarea", rows: 3, width: 12, value: purchase.napomena || "" },
    ],
    submitLabel: "Sačuvaj izmene",
    cancelUrl: `/admin/kupljeni-paketi/detalji/${purchase.id}`,
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Kupljeni paketi", url: "/admin/kupljeni-paketi" },
      { label: purchase.paket, url: `/admin/kupljeni-paketi/detalji/${purchase.id}` },
      { label: "Izmena", url: null },
    ],
  };
}

export default {
  preparePackagePurchaseListData,
  preparePackagePurchaseDetailsData,
  preparePackagePurchaseFormData,
  preparePackagePurchaseEditFormData,
};