import { DEFAULT_WHEEL_SLUG } from "../../../models/wheel.model.js";

const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

/** Forma za dodavanje / izmenu točka sreće; `wheel` je servisni prikaz postojećeg točka. */
export function prepareWheelFormData(wheel = null, { wheels = [] } = {}) {
  const isEdit = !!wheel;
  const v = wheel || { isActive: true, order: 0 };
  const isDefault = isEdit && wheel.slug === DEFAULT_WHEEL_SLUG;
  return {
    formAction: isEdit ? `/admin/tocak/tockovi/${wheel.id}` : "/admin/tocak/tockovi",
    cancelUrl: "/admin/tocak/tockovi",
    isEdit,
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Točak sreće", url: "/admin/tocak" },
      { label: "Točkovi", url: "/admin/tocak/tockovi" },
      { label: isEdit ? "Izmena točka" : "Novi točak", url: null },
    ],
    fields: [
      { name: "name", label: "Naziv točka", type: "text", width: 8, value: v.name || "", required: true, max: 80, help: "Samo za vas, npr. „Sajam lepote 2026“." },
      isEdit
        ? { name: "slugInfo", label: "Link", type: "text", width: 4, value: `/tocak${isDefault ? "" : `/${wheel.slug}`}`, disabled: true, help: "Link se ne menja jer na njega vode odštampani QR kodovi." }
        : { name: "slug", label: "Link (slug)", type: "text", width: 4, value: v.slug || "", placeholder: "npr. sajam-lepote", help: "Prazno = iz naziva. Adresa će biti /tocak/<link>. Ne može se kasnije menjati." },
      { name: "title", label: "Naslov na javnoj strani", type: "text", width: 12, value: v.title || "", max: 120, placeholder: "Zavrtite točak sreće", help: "Prazno = podrazumevani naslov." },
      { name: "intro", label: "Uvodni tekst", type: "textarea", width: 12, rows: 2, value: v.intro || "", max: 300, help: "Prazno = podrazumevani tekst." },
      { sectionTitle: "Trajanje", name: "validFrom", label: "Počinje", type: "date", width: 4, value: toDateInput(v.validFrom), help: "Opciono." },
      { name: "validUntil", label: "Traje do", type: "date", width: 4, value: toDateInput(v.validUntil), help: "Opciono. Posle tog dana javna strana kaže da igra nije aktivna." },
      { name: "order", label: "Redosled", type: "number", width: 4, value: v.order ?? 0, step: 1 },
      { name: "isActive", label: "Aktivan", type: "checkbox", width: 12, value: v.isActive !== false, disabled: isDefault },
      ...(isEdit
        ? []
        : [
            {
              name: "copyFrom",
              label: "Kopiraj nagrade sa točka",
              type: "select",
              width: 12,
              value: "",
              options: [{ value: "", label: "- ništa, nagrade dodajem ručno -" }, ...wheels.map((w) => ({ value: w.id || w.value, label: w.label }))],
              help: "Kopiraju se šanse, zalihe i popusti (podeljeni brojevi kreću od nule).",
            },
          ]),
    ],
    submitLabel: isEdit ? "Sačuvaj izmene" : "Napravi točak",
  };
}

export default { prepareWheelFormData };
