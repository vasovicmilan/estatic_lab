import { buildAdminPagination, markSortableColumns, buildSortState } from "../../../utils/admin-list.util.js";
import { LEAD_SEGMENTS } from "../../../models/lead.model.js";
import { SEGMENT_LABELS } from "../../../mappers/lead.mapper.js";

export const SORT_MAP = {
  imePrezime: "firstName",
  email: "email",
  segment: "segment",
  izvor: "source",
  nagrada: "prizeLabel",
  datum: "createdAt",
};

export function prepareLeadListData(result, query = {}, sources = []) {
  return {
    items: result.data,
    columns: markSortableColumns(
      [
        { key: "imePrezime", label: "Ime i prezime" },
        { key: "email", label: "Email" },
        { key: "segment", label: "Interesovanje" },
        { key: "izvor", label: "Izvor" },
        { key: "nagrada", label: "Nagrada" },
        { key: "kod", label: "Kod" },
        { key: "iskoriscen", label: "Iskorišćen" },
        { key: "datum", label: "Datum" },
      ],
      SORT_MAP
    ),
    actions: [
      { type: "view", url: "/admin/tocak/detalji/", icon: "eye" },
      { type: "delete", url: "/admin/tocak/", icon: "trash" },
    ],
    sort: buildSortState(query, SORT_MAP),
    pagination: buildAdminPagination(result, { basePath: "/admin/tocak", query }),
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Točak sreće", url: null },
    ],
    topbar: {
      searchUrl: "/admin/tocak/pretraga",
      search: query.search || "",
      createUrl: "/admin/tocak/nagrade",
      createLabel: "Nagrade, QR i izvoz",
      filters: [
        {
          type: "select",
          name: "segment",
          label: "Interesovanje",
          value: query.segment || "",
          options: [{ value: "", label: "Sva" }, ...LEAD_SEGMENTS.map((s) => ({ value: s, label: SEGMENT_LABELS[s] }))],
        },
        {
          type: "select",
          name: "source",
          label: "Izvor",
          value: query.source || "",
          options: [{ value: "", label: "Svi izvori" }, ...sources.map((s) => ({ value: s, label: s }))],
        },
      ],
    },
  };
}

export function prepareLeadDetailsData(lead) {
  return {
    backUrl: "/admin/tocak",
    sections: [
      {
        title: "Kontakt",
        type: "table",
        rows: [
          { label: "Ime", value: lead.osnovno.ime },
          { label: "Prezime", value: lead.osnovno.prezime },
          { label: "Email", value: lead.osnovno.email },
          { label: "Telefon", value: lead.osnovno.telefon || "-" },
          { label: "Interesovanje", value: lead.osnovno.segment },
          { label: "Izvor", value: lead.osnovno.izvor },
        ],
      },
      {
        title: "Nagrada",
        type: "table",
        rows: [
          { label: "Osvojeno", value: lead.nagrada.naziv },
          { label: "Kod", value: lead.nagrada.kod },
          { label: "Važi do", value: lead.nagrada.vaziDo },
          { label: "Iskorišćen", value: lead.nagrada.iskoriscen },
        ],
      },
    ],
    sidebar: [
      {
        title: "Saglasnosti",
        type: "table",
        rows: [
          { label: "Kontakt u vezi nagrade", value: lead.osnovno.saglasnostKontakt },
          { label: "Newsletter", value: lead.osnovno.saglasnostMarketing },
        ],
      },
      { title: "Vreme", type: "table", rows: [{ label: "Vrtenje", value: lead.vreme.kreirano }] },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Točak sreće", url: "/admin/tocak" },
      { label: lead.osnovno.ime, url: null },
    ],
  };
}

export default { prepareLeadListData, prepareLeadDetailsData, SORT_MAP };
