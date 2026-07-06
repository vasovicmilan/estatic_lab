export function prepareAdminProfileFormData(user) {
  return {
    formAction: "/admin/profil",
    isEdit: true,
    fields: [
      { name: "firstName", label: "Ime", type: "text", required: true, width: 6, value: user.firstName },
      { name: "lastName", label: "Prezime", type: "text", required: true, width: 6, value: user.lastName },
      { name: "phone", label: "Telefon", type: "tel", width: 6, value: user.telefon || "" },
      { name: "email", label: "Email", type: "email", width: 6, value: user.email, disabled: true, help: "Email se ne može menjati sa ove strane." },
    ],
    submitLabel: "Sačuvaj izmene",
    cancelUrl: "/admin",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Moj profil", url: null },
    ],
  };
}

export default { prepareAdminProfileFormData };