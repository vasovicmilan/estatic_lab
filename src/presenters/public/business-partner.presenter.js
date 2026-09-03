export function prepareBusinessPartnerListData(partners = []) {
  return {
    partners,
    breadcrumbs: [{ label: "Saradnici", url: null }],
  };
}

export function prepareBusinessPartnerDetailData(partner) {
  return {
    partner,
    breadcrumbs: [
      { label: "Saradnici", url: "/saradnici" },
      { label: partner.naziv, url: null },
    ],
  };
}

export default { prepareBusinessPartnerListData, prepareBusinessPartnerDetailData };
