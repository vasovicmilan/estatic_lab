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
    sections: [
      {
        title: "Osnovni podaci",
        type: "table",
        rows: [
          { label: "Korisnik", value: purchase.korisnik },
          { label: "Paket", value: purchase.paket },
          { label: "Status", value: purchase.status },
          { label: "Napomena", value: purchase.napomena || "-" },
        ],
      },
      {
        title: "Usluge u paketu",
        type: "table",
        rows: purchase.stavke.map((s) => ({
          label: s.usluga,
          value: `${s.iskorisceno} / ${s.ukupnoSeansi} iskorišćeno (${s.preostalo} preostalo)`,
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

export function preparePackagePurchaseFormData({ userOptions = [], packageOptions = [], prefillUserId = "" } = {}) {
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
        type: "select",
        required: true,
        width: 6,
        options: packageOptions,
      },
      { name: "pricePaid", label: "Plaćena cena (opciono — podrazumevano cena paketa)", type: "number", min: 0, step: "0.01", width: 6 },
      { name: "expiresAt", label: "Ističe (opciono — prazno = ne ističe)", type: "date", width: 6 },
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

export default {
  preparePackagePurchaseListData,
  preparePackagePurchaseDetailsData,
  preparePackagePurchaseFormData,
};