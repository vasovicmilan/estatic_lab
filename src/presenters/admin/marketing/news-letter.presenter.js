import { buildAdminPagination, markSortableColumns, buildSortState } from "../../../utils/admin-list.util.js";

export const SORT_MAP = {
  email: "email",
  status: "status",
  prijavljen: "subscribedAt",
};

export function prepareNewsletterListData(result, query = {}) {
  return {
    items: result.data,
    columns: markSortableColumns(
      [
        { key: "email", label: "Email" },
        { key: "status", label: "Status" },
        { key: "interesovanja", label: "Oblast" },
        { key: "izvor", label: "Izvor" },
        { key: "prijavljen", label: "Prijavljen" },
      ],
      SORT_MAP
    ),
    sort: buildSortState(query, SORT_MAP),
    actions: [
      { type: "view", url: "/admin/newsletter/detalji/", icon: "eye" },
      { type: "delete", url: "/admin/newsletter/", icon: "trash" },
    ],
    pagination: buildAdminPagination(result, { basePath: "/admin/newsletter", query }),
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Newsletter", url: null },
    ],
    topbar: {
      searchUrl: "/admin/newsletter/pretraga",
      search: query.search || "",
      filters: [
        {
          type: "select",
          name: "status",
          label: "Status",
          value: query.status || "",
          options: [
            { value: "", label: "Svi" },
            { value: "subscribed", label: "Prijavljeni" },
            { value: "unsubscribed", label: "Odjavljeni" },
          ],
        },
        {
          type: "select",
          name: "interest",
          label: "Oblast",
          value: query.interest || "",
          options: [
            { value: "", label: "Sve oblasti" },
            { value: "general", label: "Usluge, tretmani i paketi" },
            { value: "products", label: "Kozmetika i proizvodi" },
            { value: "partnership", label: "B2B / partnerstvo" },
          ],
        },
        {
          type: "select",
          name: "source",
          label: "Izvor",
          value: query.source || "",
          options: [
            { value: "", label: "Svi izvori" },
            { value: "footer", label: "Footer sajta" },
            { value: "tocak", label: "Točak sreće" },
            { value: "api", label: "API / frontend" },
            { value: "admin", label: "Admin" },
            { value: "unknown", label: "Nepoznato" },
          ],
        },
      ],
    },
  };
}

export function prepareNewsletterDetailsData(subscriber) {
  return {
    backUrl: "/admin/newsletter",
    sections: [
      {
        title: "Podaci",
        type: "table",
        rows: [
          { label: "Email", value: subscriber.osnovno.email },
          { label: "Status", value: subscriber.osnovno.status },
          { label: "Oblast", value: subscriber.osnovno.interesovanja.join(", ") },
          { label: "Izvor", value: subscriber.osnovno.izvor },
          { label: "Detalj izvora", value: subscriber.osnovno.izvorDetalj || "-" },
        ],
      },
    ],
    sidebar: [
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Prijavljen", value: subscriber.vreme.prijavljen },
          { label: "Odjavljen", value: subscriber.vreme.odjavljen || "-" },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Newsletter", url: "/admin/newsletter" },
      { label: subscriber.osnovno.email, url: null },
    ],
  };
}
