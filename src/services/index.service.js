import serviceService from "./service.service.js";
import expertService from "./expert.service.js";
import testimonialService from "./testimonial.service.js";
import postService from "./post.service.js";
import packageService from "./package.service.js";
import contactService from "./contact.service.js";
import newsLetterService from "./news-letter.service.js";
import { buildPageSeo } from "../seo/index.js";
import { validationError } from "../utils/error.util.js";

export async function getLandingPageData({
  highlightedServiceLimit = 6,
  featuredExpertLimit = 4,
  testimonialLimit = 6,
  latestPostLimit = 3,
  bestPackageLimit = 3,
} = {}) {
  const [highlightedServices, allExperts, testimonials, latestPosts, packagesResult] = await Promise.all([
    serviceService.findHighlightedServices({ limit: highlightedServiceLimit }),
    expertService.getActiveExperts(),
    testimonialService.getApprovedTestimonials({ limit: testimonialLimit, featuredOnly: true }),
    postService.findPublishedPosts({ limit: latestPostLimit }),
    packageService.findActivePackages({ limit: bestPackageLimit }),
  ]);

  const seo = buildPageSeo({
    title: "Estetik Lab | Vaš prostor za opuštanje i negu",
    description: "Zakažite termin za masažu, tretmane lica i tela u opuštajućem ambijentu Estetik Lab wellness centra.",
    canonical: "/",
    isIndexable: true,
    type: "website",
  });

  return {
    highlightedServices,
    featuredExperts: allExperts.slice(0, featuredExpertLimit),
    testimonials,
    latestPosts: latestPosts.data || [],
    bestPackages: packagesResult.data || [],
    seo,
  };
}

export async function getAboutPageData() {
  const seo = buildPageSeo({
    title: "O nama | Estetik Lab",
    description: "Saznajte više o Estetik Lab wellness centru, našem timu i filozofiji nege.",
    canonical: "/o-nama",
    isIndexable: true,
  });
  return { seo };
}

export async function getPrivacyPolicyPageData() {
  const seo = buildPageSeo({
    title: "Politika privatnosti | Estetik Lab",
    description: "Informacije o zaštiti podataka o ličnosti i privatnosti korisnika Estetik Lab sajta.",
    canonical: "/politika-privatnosti",
    isIndexable: true,
  });
  return { seo };
}

export async function getTermsAndConditionsPageData() {
  const seo = buildPageSeo({
    title: "Uslovi korišćenja | Estetik Lab",
    description: "Uslovi korišćenja Estetik Lab sajta i pravila zakazivanja termina.",
    canonical: "/uslovi-koriscenja",
    isIndexable: true,
  });
  return { seo };
}

export async function getFaqPageData() {
  const seo = buildPageSeo({
    title: "Česta pitanja (FAQ) | Estetik Lab",
    description: "Odgovori na najčešća pitanja o zakazivanju, uslugama, plaćanju i otkazivanju termina.",
    canonical: "/faq",
    isIndexable: true,
  });
  return { seo };
}

export async function getContactPageData() {
  const seo = buildPageSeo({
    title: "Kontakt | Estetik Lab",
    description: "Kontaktirajte Estetik Lab tim za pitanja o uslugama, terminima ili saradnji.",
    canonical: "/kontakt",
    isIndexable: false,
  });
  return { seo };
}

// ==================== PUBLIC SUBMISSION ENDPOINTS ====================
// Thin pass-throughs kept here (rather than requiring the contact/blog/marketing
// controllers to import three separate services) since these are exactly the forms
// that live on general-purpose public pages (footer newsletter box, contact page,
// "leave a review" widget) rather than one specific domain's own page.

export async function submitContactForm(data, meta) {
  if (!data?.firstName || !data?.email || !data?.message) {
    validationError("Sva obavezna polja moraju biti popunjena");
  }
  return contactService.submitContact(data, meta);
}

export async function submitTestimonialForm(data) {
  if (!data?.rating || !data?.message) {
    validationError("Ocena i komentar su obavezni");
  }
  return testimonialService.submitTestimonial(data);
}

export async function submitNewsletterForm(email) {
  if (!email) validationError("email");
  return newsLetterService.subscribe(email);
}

export async function unsubscribeNewsletter(token) {
  if (!token) validationError("token");
  return newsLetterService.unsubscribe(token);
}

export default {
  getLandingPageData,
  getAboutPageData,
  getPrivacyPolicyPageData,
  getTermsAndConditionsPageData,
  getFaqPageData,
  getContactPageData,
  submitContactForm,
  submitTestimonialForm,
  submitNewsletterForm,
  unsubscribeNewsletter,
};