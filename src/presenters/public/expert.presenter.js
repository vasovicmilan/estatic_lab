export function prepareExpertListData(experts) {
  return {
    experts,
    breadcrumbs: [{ label: "Naš tim", url: null }],
  };
}

export function prepareExpertDetailData(expert) {
  return {
    expert,
    bookingUrl: "/zakazivanje",
    breadcrumbs: [
      { label: "Naš tim", url: "/nas-tim" },
      { label: expert.imePrezime, url: null },
    ],
  };
}
