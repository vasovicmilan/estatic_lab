import { formatMoney } from "../../../utils/price.util.js";
import { buildAdminPagination, markSortableColumns, buildSortState } from "../../../utils/admin-list.util.js";

// `korisnik` is firstName + lastName concatenated for display - not a scalar
// column - so only the email snapshot is offered for identity sorting.
// Same mapping as api/v1 admin-order.controller's TEMP_ORDER_SORT_FIELDS.
export const SORT_MAP = {
  email: "contactSnapshot.email",
  ukupnaCena: "totalPrice",
  zahtevaProceenuDostave: "requiresShippingQuote",
  istice: "tokenExpiration",
  kreirano: "createdAt",
};

export function prepareTempOrderListData(result, query = {}) {
  return {
    items: result.data,
    columns: markSortableColumns(
      [
        { key: "korisnik", label: "Korisnik" },
        { key: "email", label: "Email" },
        { key: "ukupnaCena", label: "Ukupno" },
        { key: "zahtevaProceenuDostave", label: "Čeka procenu dostave" },
        { key: "istice", label: "Ističe" },
        { key: "kreirano", label: "Kreirano" },
      ],
      SORT_MAP
    ),
    sort: buildSortState(query, SORT_MAP),
    actions: [{ type: "view", url: "/admin/privremene-porudzbine/detalji/", icon: "eye" }],
    pagination: buildAdminPagination(result, { basePath: "/admin/privremene-porudzbine", query }),
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
          value: `${s.kolicina} x ${formatMoney(s.cena)}`,
        })),
      },
      {
        title: "Cena",
        type: "table",
        rows: [
          { label: "Subtotal", value: formatMoney(order.subtotal) },
          { label: "Dostava", value: order.zahtevaProceenuDostave ? "Čeka procenu (veliki/teški artikal)" : formatMoney(order.dostava) },
          { label: "Kupon", value: order.kupon || "-" },
          { label: "Ukupno", value: order.zahtevaProceenuDostave ? "Zavisi od cene dostave" : formatMoney(order.ukupnaCena) },
        ],
      },
    ],
    sidebar: [
      ...(order.zahtevaProceenuDostave
        ? [
            {
              title: "Potrebna procena dostave",
              type: "custom",
              content: "temporary-order-shipping-form",
              data: { orderId: order.id },
            },
          ]
        : []),
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