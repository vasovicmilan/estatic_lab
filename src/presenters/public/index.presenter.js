// Static marketing copy — no service/DB backing needed, these are fixed selling
// points rather than content an admin manages. Icons are Bootstrap Icons classes
// (already loaded site-wide via head.ejs), rendered with the existing `bi` classes.
const WHY_US = [
  {
    icon: "bi-cpu",
    title: "Profesionalna ESMA oprema",
    text: "Tretmani na ESMA Favorit aparatu — miostimulacija, limfna drenaža, mikrostrujni lifting i laserska biorevitalizacija u jednom mestu.",
  },
  {
    icon: "bi-patch-check",
    title: "Sertifikovani terapeuti",
    text: "Naš tim čine obučeni terapeuti sa iskustvom u masaži i estetskim tretmanima tela i lica.",
  },
  {
    icon: "bi-person-heart",
    title: "Individualni pristup",
    text: "Svaki tretman prilagođavamo vašoj koži, telu i cilju — bez univerzalnih rešenja.",
  },
  {
    icon: "bi-flower1",
    title: "Opuštajući ambijent",
    text: "Mirna, čista i negovana atmosfera osmišljena da vam pruži pravi predah od svakodnevice.",
  },
];

export function prepareHomeData({
  highlightedServices = [],
  featuredExperts = [],
  testimonials = [],
  latestPosts = [],
  bestPackages = [],
} = {}) {
  return {
    hero: {
      eyebrow: "Estatic Lab wellness centar",
      title: "Vaš prostor za opuštanje i negu",
      subtitle: "Masaže, ESMA tretmani i nega lica i tela u mirnom, opuštajućem ambijentu — uz stručan tim i individualan pristup svakom klijentu.",
      ctaLabel: "Zakažite termin",
      ctaUrl: "/usluge",
      secondaryCtaLabel: "Pogledajte pakete",
      secondaryCtaUrl: "/paketi",
      // drop a real photo at this path (src/public/img/hero.jpg) — the hero section
      // gracefully falls back to a plain gradient background if it's missing
      image: "/img/hero.jpg",
    },
    whyUs: WHY_US,
    highlightedServices,
    featuredExperts,
    testimonials,
    bestPackages,
    latestPosts,
    testimonialFormAction: "/testimonials/posalji",
  };
}

export default { prepareHomeData };