export function prepareManualOrderFormData({ products = [], userOptions = [] } = {}) {
  return {
    products,
    userOptions,
    formAction: "/admin/porudzbine/rucno-kreiranje",
    breadcrumbs: [
      { label: "Admin", url: "/admin" },
      { label: "Porudžbine", url: "/admin/porudzbine" },
      { label: "Nova porudžbina (ručno)", url: null },
    ],
    cancelUrl: "/admin/porudzbine",
  };
}

export default { prepareManualOrderFormData };
