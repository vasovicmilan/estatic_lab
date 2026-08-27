// Gives /nas-tim the same real, indexable intro copy the other listing pages
// already have (BLOG_INTRO in blog.presenter.js, SHOP_INTRO in
// product.presenter.js) instead of a bare heading over a grid of cards.
const TEAM_INTRO = {
  eyebrow: "Naš tim",
  title: "Stručnjaci iza svakog tretmana",
  lead:
    "Svaki terapeut u Estetik Lab timu ima sertifikovanu obuku za oblast u kojoj radi - od klasične masaže do ESMA estetskih tretmana - i redovno prolazi kroz proveru protokola.",
  highlights: [
    { icon: "bi-patch-check", title: "Sertifikovana obuka", text: "Svaki član tima prošao je obuku i proveru za tretmane koje izvodi." },
    { icon: "bi-heart-pulse", title: "Specijalizacije", text: "Od klasične i sportske masaže do ESMA estetskih tretmana lica i tela." },
    { icon: "bi-calendar-check", title: "Zakazivanje po terapeutu", text: "Birate omiljenog terapeuta direktno prilikom zakazivanja termina." },
  ],
};

export function prepareExpertListData(experts) {
  return {
    experts,
    intro: TEAM_INTRO,
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
