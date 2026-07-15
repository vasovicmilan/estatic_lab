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
  const addressText = "Maksima Gorkog 6b, Novi Sad 21120";

  const mapParam =
    "!1m18!1m12!1m3!1d2808.909996570131!2d19.843611977018323!3d45.24961274772971!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x475b106c892d2953%3A0x78a7de03d4dbf444!2sMaksima%20Gorkog%206b%2C%20Novi%20Sad%2021120!5e0!3m2!1sen!2srs!4v1784121266023!5m2!1sen!2srs";

  return {
    hero: {
      eyebrow: "Estatik Lab wellness centar",
      title: "Vaš prostor za opuštanje i negu",
      subtitle:
        "Masaže, ESMA tretmani i nega lica i tela u mirnom, opuštajućem ambijentu — uz stručan tim i individualan pristup svakom klijentu.",
      ctaLabel: "Zakažite termin",
      ctaUrl: "/usluge",
      secondaryCtaLabel: "Pogledajte pakete",
      secondaryCtaUrl: "/paketi",
      image: "/img/hero.jpg",
    },

    whyUs: WHY_US,
    highlightedServices,
    featuredExperts,
    testimonials,
    bestPackages,
    latestPosts,
    testimonialFormAction: "/testimonials/posalji",

    map: {
      address: addressText,
      embedUrl: `https://www.google.com/maps/embed?pb=${mapParam}`,
    },
  };
}

export default { prepareHomeData };