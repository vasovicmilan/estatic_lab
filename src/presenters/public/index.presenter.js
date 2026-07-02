export function prepareHomeData({
  highlightedServices = [],
  featuredExperts = [],
  testimonials = [],
  latestPosts = [],
} = {}) {
  return {
    hero: {
      title: "Vaš prostor za opuštanje i negu",
      ctaLabel: "Zakažite termin",
      ctaUrl: "/usluge",
    },
    highlightedServices,
    featuredExperts,
    testimonials,
    latestPosts,
  };
}