export function buildPageSeo({ title, description, canonical, isIndexable = true, type = "website" } = {}) {
  return {
    pageTitle: title || "Estatic Lab",
    pageDescription: description || "",
    canonical: canonical || "/",
    robots: isIndexable ? "index, follow" : "noindex, nofollow",
    og: {
      title: title || "Estatic Lab",
      description: description || "",
      type,
      url: canonical || "/",
    },
  };
}

export default { buildPageSeo };