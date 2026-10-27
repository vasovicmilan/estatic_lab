import { buildAdminPagination, markSortableColumns, buildSortState } from "../../../utils/admin-list.util.js";

// `earnerName` is resolved from the employee/partner record, not a column on
// PayoutRequest, so it is not sortable (same as api/v1 PAYOUT_SORT_FIELDS).
export const SORT_MAP = {
  earnerType: "earnerType",
  iznos: "amount",
  status: "status",
  zatrazeno: "requestedAt",
};

export function preparePayoutRequestListData(result, query = {}) {
  return {
    items: result.data,
    columns: markSortableColumns(
      [
        { key: "earnerType", label: "Tip" },
        { key: "earnerName", label: "Ime" },
        { key: "iznos", label: "Iznos" },
        { key: "status", label: "Status" },
        { key: "zatrazeno", label: "Zatraženo" },
      ],
      SORT_MAP
    ),
    sort: buildSortState(query, SORT_MAP),
    actions: [{ type: "view", url: "/admin/isplate/detalji/", icon: "eye" }],
    pagination: buildAdminPagination(result, { basePath: "/admin/isplate", query }),
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Isplate", url: null },
    ],
    topbar: {
      search: "",
      filters: [
        {
          type: "select",
          name: "status",
          label: "Status",
          value: query.status || "",
          options: [
            { value: "", label: "Svi" },
            { value: "requested", label: "Zatraženo" },
            { value: "approved", label: "Odobreno" },
            { value: "paid", label: "Isplaćeno" },
            { value: "rejected", label: "Odbijeno" },
          ],
        },
        {
          type: "select",
          name: "earnerType",
          label: "Tip",
          value: query.earnerType || "",
          options: [
            { value: "", label: "Svi" },
            { value: "employee", label: "Zaposleni" },
            { value: "partner", label: "Partner" },
          ],
        },
      ],
    },
  };
}

export function preparePayoutRequestDetailsData(request) {
  const actionsByStatus = {
    requested: [
      { label: "Odobri", url: `/admin/isplate/${request.id}/odobri`, variant: "primary" },
      { label: "Označi kao isplaćeno", url: `/admin/isplate/${request.id}/isplati`, variant: "success" },
      { label: "Odbij", url: `/admin/isplate/${request.id}/odbij`, variant: "danger" },
    ],
    approved: [
      { label: "Označi kao isplaćeno", url: `/admin/isplate/${request.id}/isplati`, variant: "success" },
      { label: "Odbij", url: `/admin/isplate/${request.id}/odbij`, variant: "danger" },
    ],
    paid: [],
    rejected: [],
  };

  return {
    backUrl: "/admin/isplate",
    sections: [
      {
        title: "Podaci o zahtevu",
        type: "table",
        rows: [
          { label: "Tip", value: request.earnerType },
          { label: "Ime", value: request.earnerName },
          { label: "Iznos", value: request.iznos },
          { label: "Status", value: request.status },
          { label: "Napomena", value: request.napomena || "-" },
        ],
      },
    ],
    sidebar: [
      {
        title: "Promena statusa",
        type: "custom",
        content: "payout-request-status-actions",
        data: { requestId: request.id, actions: actionsByStatus[request.statusRaw] || [] },
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Zatraženo", value: request.vreme.zatrazeno },
          { label: "Odobreno", value: request.vreme.odobreno || "-" },
          { label: "Isplaćeno", value: request.vreme.isplaceno || "-" },
          { label: "Odbijeno", value: request.vreme.odbijeno || "-" },
        ],
      },
    ],
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Isplate", url: "/admin/isplate" },
      { label: request.earnerName, url: null },
    ],
  };
}