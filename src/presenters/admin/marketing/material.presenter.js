import { escapeHtml } from "../../../utils/html.util.js";
import { buildAdminPagination, markSortableColumns, buildSortState } from "../../../utils/admin-list.util.js";

export const SORT_MAP = {
  naziv: "title",
  aktivan: "isActive",
  otvaranja: "viewCount",
  preuzimanja: "downloadCount",
  kreirano: "createdAt",
};

export function prepareMaterialListData(result, query = {}) {
  return {
    items: result.data,
    columns: markSortableColumns(
      [
        { key: "naziv", label: "Naziv" },
        { key: "tip", label: "Tip" },
        { key: "velicina", label: "Veličina" },
        { key: "aktivan", label: "Aktivan" },
        { key: "otvaranja", label: "Otvaranja" },
        { key: "preuzimanja", label: "Preuzimanja" },
        { key: "kreirano", label: "Kreirano" },
      ],
      SORT_MAP
    ),
    actions: [
      { type: "view", url: "/admin/materijali/detalji/", icon: "eye" },
      { type: "edit", url: "/admin/materijali/izmena/", icon: "pencil" },
      { type: "delete", url: "/admin/materijali/", icon: "trash" },
    ],
    sort: buildSortState(query, SORT_MAP),
    pagination: buildAdminPagination(result, { basePath: "/admin/materijali", query }),
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Materijali", url: null },
    ],
    topbar: {
      createUrl: "/admin/materijali/dodavanje",
      createLabel: "Novi materijal",
      searchUrl: "/admin/materijali/pretraga",
      search: query.search || "",
    },
  };
}

export function prepareMaterialDetailsData(material, { publicUrl, qrSvg }) {
  return {
    backUrl: "/admin/materijali",
    editUrl: `/admin/materijali/izmena/${material.id}`,
    sections: [
      {
        title: "Osnovni podaci",
        type: "table",
        rows: [
          { label: "Naziv", value: material.naziv },
          { label: "Opis", value: material.opis || "-" },
          { label: "Aktivan", value: material.aktivan ? "Da" : "Ne" },
          { label: "Fajl", value: `${material.fajl.naziv} (${material.fajl.tip}, ${material.fajl.velicina})` },
        ],
      },
      {
        title: "Link i QR kod",
        type: "custom",
        content: `
          <p class="mb-2">Stranica koju posetilac vidi nakon skeniranja koda:</p>
          <p class="mb-3"><a href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener">${escapeHtml(publicUrl)}</a></p>
          <div class="mb-3" style="max-width:240px">${qrSvg}</div>
          <a class="btn btn-sm btn-outline-primary me-2" href="/admin/materijali/${material.id}/qr.svg">Preuzmi QR (SVG)</a>
          <a class="btn btn-sm btn-outline-primary" href="/admin/materijali/${material.id}/qr.png">Preuzmi QR (PNG)</a>
          <p class="text-muted small mt-3 mb-0">Link i QR se ne menjaju kad zameniš fajl - isti odštampan kod uvek vodi na najnoviju verziju.</p>`,
      },
    ],
    sidebar: [
      {
        title: "Statistika",
        type: "table",
        rows: [
          { label: "Otvaranja stranice", value: material.otvaranja },
          { label: "Preuzimanja", value: material.preuzimanja },
        ],
      },
      {
        title: "Vreme",
        type: "table",
        rows: [
          { label: "Kreirano", value: material.vreme.kreiran },
          { label: "Izmenjeno", value: material.vreme.azuriran },
        ],
      },
    ],
  };
}

export function prepareMaterialFormData(material = null) {
  const isEdit = !!material;
  const values = material || { title: "", description: "", isActive: true };

  return {
    formAction: isEdit ? `/admin/materijali/${material.id}` : "/admin/materijali",
    cancelUrl: isEdit ? `/admin/materijali/detalji/${material.id}` : "/admin/materijali",
    isEdit,
    formEnctype: "multipart/form-data",
    fields: [
      { name: "title", label: "Naziv materijala", type: "text", width: 12, required: true, value: values.title, help: "Ovo vidi posetilac na stranici (npr. „Ponuda za B2B partnere 2026“)." },
      { name: "description", label: "Kratak opis", type: "textarea", rows: 3, width: 12, value: values.description, help: "Najviše 1000 karaktera. Prikazuje se iznad dugmeta za preuzimanje." },
      {
        name: "file",
        label: isEdit ? "Zameni fajl (opciono)" : "Fajl",
        type: "file",
        accept: ".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.pptx,application/pdf,image/jpeg,image/png,image/webp",
        required: !isEdit,
        width: 12,
        help: isEdit
          ? `Trenutno: ${material.file?.originalName || "-"}. Ako izabereš novi fajl, stari se briše, a link i QR ostaju isti.`
          : "PDF, slika (JPG/PNG/WEBP), Word, Excel ili PowerPoint. Najviše 25 MB.",
      },
      { name: "isActive", label: "Aktivan (dostupan za preuzimanje)", type: "checkbox", width: 12, value: values.isActive },
    ],
    submitLabel: isEdit ? "Sačuvaj izmene" : "Otpremi materijal",
  };
}

export default { prepareMaterialListData, prepareMaterialDetailsData, prepareMaterialFormData };
