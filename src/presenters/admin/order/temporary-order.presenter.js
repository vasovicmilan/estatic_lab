export function prepareTempOrderListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "korisnik", label: "Korisnik" },
      { key: "email", label: "Email" },
      { key: "ukupnaCena", label: "Ukupno" },
      { key: "istice", label: "Ističe" },
      { key: "kreirano", label: "Kreirano" },
    ],
    actions: [{ type: "view", url: "/admin/privremene-porudzbine/detalji/", icon: "eye" }],
    pagination: {
      currentPage: result.page,
      totalPages: result.totalPages,
      basePath: "/admin/privremene-porudzbine",
      query,
    },
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Privremene porudžbine", url: null },
    ],
    topbar: {
      searchUrl: "/admin/privremene-porudzbine/pretraga",
      search: query.search || "",
    },
  };
}

export function prepareTempOrderDetailsData(order) {
  return {
    backUrl: "/admin/privremene-porudzbine",
    sections: [
      {
        title: "Korisnik",
        type: "table",
        rows: [
          { label: "Ime", value: order.korisnik.ime },
          { label: "Email", value: order.korisnik.email },
          { label: "Telefon", value: order.korisnik.telefon || "-" },
        ],
      },
      {
        title: "Adresa za dostavu",
        type: "table",
        rows: order.adresa
          ? [
              { label: "Grad", value: order.adresa.grad },
              { label: "Poštanski broj", value: order.adresa.postanskiBroj },
              { label: "Ulica i broj", value: `${order.adresa.ulica} ${order.adresa.broj}` },
            ]
          : [{ label: "Adresa", value: "-" }],
      },
      {
        title: "Stavke",
        type: "table",
        rows: order.stavke.map((s) => ({
          label: `${s.naziv} - ${s.varijanta}`,
          value: `${s.kolicina} x ${s.cena} RSD`,
        })),
      },
      {
        title: "Cena",
        type: "table",
        rows: [
          { label: "Subtotal", value: `${order.subtotal} RSD` },
          { label: "Dostava", value: `${order.dostava} RSD` },
          { label: "Kupon", value: order.kupon || "-" },
          { label: "Ukupno", value: `${order.ukupnaCena} RSD` },
        ],
      },
    ],
    sidebar: [
      {
        title: "Potvrdi porudžbinu",
        type: "custom",
        content: "temporary-order-confirm-action",
        data: { orderId: order.id },
      },
      {
        title: "Potvrda",
        type: "table",
        rows: [
          { label: "Ističe", value: order.token.istice },
          { label: "Istekao", value: order.token.istekao ? "Da - kupac više ne može sam da potvrdi" : "Ne" },
        ],
      },
      {
        title: "Napomena",
        type: "table",
        rows: [{ label: "Napomena kupca", value: order.napomena || "-" }],
      },
      {
        title: "Vreme",
        type: "table",
        rows: [{ label: "Kreirano", value: order.vreme.kreirano }],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Privremene porudžbine", url: "/admin/privremene-porudzbine" },
      { label: order.korisnik.ime, url: null },
    ],
  };
}

export default {
  prepareTempOrderListData,
  prepareTempOrderDetailsData,
};