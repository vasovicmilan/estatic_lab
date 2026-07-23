const SOURCE_TYPE_LABELS = {
  appointment: "Termin",
  order: "Porudžbina",
  package_purchase: "Paket",
};

const STATUS_LABELS = {
  pending: "Na čekanju",
  earned: "Zarađeno",
  reversed: "Stornirano",
};

export function translateCommissionSourceType(sourceType) {
  return SOURCE_TYPE_LABELS[sourceType] || sourceType;
}

export function translateCommissionStatus(status) {
  return STATUS_LABELS[status] || status;
}

export default { translateCommissionSourceType, translateCommissionStatus };