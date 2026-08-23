export function prepareSiteSettingsFormData(settings) {
  const values = settings || { hero: { image: null, imageAlt: "" } };

  const fields = [
    {
      name: "heroImage",
      label: "Hero slika (naslovna slika početne strane)",
      type: "file",
      accept: "image/*",
      required: false,
      width: 6,
      preview: values.hero?.image || null,
      help: "Preporučena širina: 1600px. Ako se ne izabere nova slika, zadržava se postojeća.",
    },
    {
      name: "heroImageAlt",
      label: "Opis slike (alt tekst)",
      type: "text",
      width: 6,
      required: false,
      value: values.hero?.imageAlt || "",
    },
  ];

  return {
    formAction: "/admin/sajt",
    formEnctype: "multipart/form-data",
    isEdit: true,
    fields,
    submitLabel: "Sačuvaj izmene",
    cancelUrl: "/admin",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Sadržaj sajta", url: null },
    ],
  };
}

export default { prepareSiteSettingsFormData };