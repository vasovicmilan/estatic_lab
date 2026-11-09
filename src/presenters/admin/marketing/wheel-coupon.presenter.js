import { buildAdminPagination } from "../../../utils/admin-list.util.js";

/** List of the single-use coupons handed out by the wheel (separate from /admin/kuponi). */
export function prepareWheelCouponListData(result, query = {}) {
  return {
    items: result.data,
    columns: [
      { key: "kod", label: "Kod" },
      { key: "nagrada", label: "Nagrada" },
      { key: "dobitnik", label: "Dobitnik" },
      { key: "status", label: "Status" },
      { key: "iskorisceno", label: "Iskorišćeno" },
      { key: "vaziDo", label: "Važi do" },
    ],
    actions: [],
    pagination: buildAdminPagination(result, { basePath: "/admin/tocak/kuponi", query }),
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Točak sreće", url: "/admin/tocak" },
      { label: "Kuponi", url: null },
    ],
    topbar: {
      searchUrl: "/admin/tocak/kuponi",
      search: query.search || "",
      extraLinks: [{ url: "/admin/tocak/nagrade", label: "Nagrade i QR" }],
      createUrl: "/admin/tocak",
      createLabel: "Kontakti",
      filters: [
        {
          type: "select",
          name: "prize",
          label: "Nagrada",
          value: query.prize || "",
          options: [{ value: "", label: "Sve nagrade" }, ...(result.prizes || []).map((p) => ({ value: p.key, label: p.label }))],
        },
        {
          type: "select",
          name: "state",
          label: "Status",
          value: query.state || "",
          options: [
            { value: "", label: "Svi" },
            { value: "active", label: "Aktivni" },
            { value: "used", label: "Iskorišćeni" },
            { value: "expired", label: "Istekli" },
          ],
        },
      ],
    },
  };
}
