import { DEFAULT_TEAM_INTRO } from "../../config/site-content-defaults.js";

// Gives /nas-tim the same real, indexable intro copy the other listing pages
// already have (BLOG_INTRO in blog.presenter.js, SHOP_INTRO in
// product.presenter.js) instead of a bare heading over a grid of cards. Used
// to be a literal constant here - now DB-backed content (see
// site-content.service.js's getTeamIntro), passed in by the caller; the
// DEFAULT_TEAM_INTRO import is only a fallback for a caller that doesn't
// pass one.
export function prepareExpertListData(experts, teamIntro = DEFAULT_TEAM_INTRO) {
  return {
    experts,
    intro: teamIntro,
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
