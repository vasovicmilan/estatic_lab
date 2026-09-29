import * as indexService from "../../services/index.service.js";
import siteContentService from "../../services/site-content.service.js";
import {
  prepareHomeData,
  preparePrivacyPolicyData,
  prepareTermsAndConditionsData,
  prepareAboutPageData,
  preparePartnershipPageData,
  prepareContactPageData,
  prepareFaqPageData,
} from "../../presenters/public/index.presenter.js";
import { buildWebsiteJsonLd, buildFaqPageJsonLd } from "../../seo/utils.seo.js";
import { logError, logWarn, logInfo } from "../../utils/logger.util.js";
import { flashAndRedirect } from "../../utils/flash.util.js";
import { getCapturedReferralCode } from "../../middlewares/coupon-capture.middleware.js";
import { toIdArray } from "../../utils/form-array.util.js";

export async function homePage(req, res, next) {
  try {
    const [serviceData, homeIntro, whyUs, homeHero, contactPage] = await Promise.all([
      indexService.getLandingPageData(),
      siteContentService.getHomeIntro(),
      siteContentService.getWhyUs(),
      siteContentService.getHomeHero(),
      siteContentService.getContactPage(),
    ]);
    const viewData = prepareHomeData({ ...serviceData, homeIntro, whyUs, homeHero, contactPage });
    serviceData.seo.jsonLd = [...(serviceData.seo.jsonLd || []), buildWebsiteJsonLd(req)];

    return res.render("landing/home", {
      pageTitle: serviceData.seo.pageTitle,
      pageDescription: serviceData.seo.pageDescription,
      seo: serviceData.seo,
      data: viewData,
    });
  } catch (error) {
    logError("[homePage] Greška pri učitavanju početne strane", error);
    next(error);
  }
}

export async function aboutPage(req, res, next) {
  try {
    const [serviceData, content] = await Promise.all([indexService.getAboutPageData(), siteContentService.getAbout()]);
    return res.render("public/_page", {
      pageTitle: serviceData.seo.pageTitle,
      pageHeading: "O nama",
      pageDescription: serviceData.seo.pageDescription,
      seo: serviceData.seo,
      showLegalContent: true,
      data: prepareAboutPageData(content),
    });
  } catch (error) {
    logError("[aboutPage] Greška pri učitavanju stranice o nama", error);
    next(error);
  }
}

export async function partnershipPage(req, res, next) {
  try {
    const [serviceData, content] = await Promise.all([indexService.getPartnershipPageData(), siteContentService.getPartnership()]);
    return res.render("landing/partnership", {
      pageTitle: serviceData.seo.pageTitle,
      pageDescription: serviceData.seo.pageDescription,
      seo: serviceData.seo,
      data: preparePartnershipPageData(content),
    });
  } catch (error) {
    logError("[partnershipPage] Greška pri učitavanju stranice partnerskog programa", error);
    next(error);
  }
}

export async function privacyPage(req, res, next) {
  try {
    const [serviceData, content] = await Promise.all([indexService.getPrivacyPolicyPageData(), siteContentService.getPrivacyPolicy()]);
    return res.render("public/_page", {
      pageTitle: serviceData.seo.pageTitle,
      pageHeading: "Politika privatnosti",
      pageDescription: serviceData.seo.pageDescription,
      seo: serviceData.seo,
      showLegalContent: true,
      data: preparePrivacyPolicyData(content),
    });
  } catch (error) {
    logError("[privacyPage] Greška pri učitavanju politike privatnosti", error);
    next(error);
  }
}

export async function termsPage(req, res, next) {
  try {
    const [serviceData, content] = await Promise.all([indexService.getTermsAndConditionsPageData(), siteContentService.getTermsAndConditions()]);
    return res.render("public/_page", {
      pageTitle: serviceData.seo.pageTitle,
      pageHeading: "Uslovi korišćenja",
      pageDescription: serviceData.seo.pageDescription,
      seo: serviceData.seo,
      showLegalContent: true,
      data: prepareTermsAndConditionsData(content),
    });
  } catch (error) {
    logError("[termsPage] Greška pri učitavanju uslova korišćenja", error);
    next(error);
  }
}

export async function faqPage(req, res, next) {
  try {
    const [serviceData, content] = await Promise.all([indexService.getFaqPageData(), siteContentService.getFaq()]);
    const faqData = prepareFaqPageData(content);
    // FAQPage rich-result eligibility - built here (controller layer) rather
    // than in the service, since getFaqPageData() intentionally stays
    // presentation-agnostic (SEO metadata only) and prepareFaqPageData()'s
    // static content lives in the presenter - the controller is what already
    // combines both for every other page in this file (see buildWebsiteJsonLd
    // usage in homePage above).
    serviceData.seo.jsonLd = [...(serviceData.seo.jsonLd || []), buildFaqPageJsonLd(faqData.items)].filter(Boolean);
    return res.render("public/_page", {
      pageTitle: serviceData.seo.pageTitle,
      pageHeading: "Česta pitanja",
      pageDescription: serviceData.seo.pageDescription,
      seo: serviceData.seo,
      showFaq: true,
      data: faqData,
    });
  } catch (error) {
    logError("[faqPage] Greška pri učitavanju FAQ stranice", error);
    next(error);
  }
}

export async function contactPage(req, res, next) {
  try {
    const [serviceData, contactContent] = await Promise.all([indexService.getContactPageData(), siteContentService.getContactPage()]);
    return res.render("public/contact", {
      pageTitle: serviceData.seo.pageTitle,
      pageDescription: serviceData.seo.pageDescription,
      seo: serviceData.seo,
      data: {
        ...prepareContactPageData(contactContent),
        formData: { topic: req.query.tema || "", arrivedWithTema: req.query.tema ? "1" : "" },
        errors: {},
        csrfToken: res.locals.csrfToken,
      },
    });
  } catch (error) {
    logError("[contactPage] Greška pri učitavanju kontakt stranice", error);
    next(error);
  }
}

export async function submitContact(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[submitContact] Validacione greške u kontakt formi", { validationErrors: req.validationErrors, email: req.body.email });
      const [serviceData, contactContent] = await Promise.all([indexService.getContactPageData(), siteContentService.getContactPage()]);
      return res.status(400).render("public/contact", {
        pageTitle: serviceData.seo.pageTitle,
        pageDescription: serviceData.seo.pageDescription,
        seo: serviceData.seo,
        data: {
          ...prepareContactPageData(contactContent),
          formData: req.body,
          errors: req.validationErrors,
          csrfToken: res.locals.csrfToken,
        },
      });
    }

    // only attach the referral code when this contact was reached with a
    // specific purpose (?tema= on the original page load, carried through via
    // the hidden arrivedWithTema field) - a generic "contact us" submission
    // should never get a referral code attached just because a stale cookie
    // happens to exist from unrelated earlier browsing
    const referralCode = req.body.arrivedWithTema === "1" ? getCapturedReferralCode(req) : null;

    await indexService.submitContactForm(req.body, { ip: req.ip, userAgent: req.headers["user-agent"], referralCode });
    logInfo("[submitContact] Kontakt poruka poslata", { email: req.body.email, referralCode });

    return flashAndRedirect(req, res, "success", "Vaša poruka je uspešno poslata. Odgovorićemo vam u najkraćem roku.", "/kontakt");
  } catch (error) {
    logError("[submitContact] Greška pri slanju kontakt poruke", error, { body: req.body });

    if (error.statusCode === 400) {
      const [serviceData, contactContent] = await Promise.all([indexService.getContactPageData(), siteContentService.getContactPage()]);
      return res.status(400).render("public/contact", {
        pageTitle: serviceData.seo.pageTitle,
        pageDescription: serviceData.seo.pageDescription,
        seo: serviceData.seo,
        data: {
          ...prepareContactPageData(contactContent),
          formData: req.body,
          errors: { general: error.message },
          csrfToken: res.locals.csrfToken,
        },
      });
    }
    next(error);
  }
}

export async function submitTestimonial(req, res, next) {
  try {
    if (req.validationErrors) {
      logWarn("[submitTestimonial] Validacione greške u formi za utisak", { validationErrors: req.validationErrors });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), req.get("Referrer") || "/");
    }

    const data = { ...req.body };
    if (req.session?.isLoggedIn) data.userId = req.session.user.id;
    data.consentIpAddress = req.ip;

    const result = await indexService.submitTestimonialForm(data);
    logInfo("[submitTestimonial] Testimonijal poslat", { name: req.body.name });

    return flashAndRedirect(req, res, "success", result.message, req.get("Referrer") || "/");
  } catch (error) {
    logError("[submitTestimonial] Greška pri slanju testimoniala", error, { body: req.body });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, req.get("Referrer") || "/");
    }
    next(error);
  }
}

export async function submitNewsletter(req, res, next) {
  try {
    if (req.validationErrors) {
      return flashAndRedirect(req, res, "error", "Unesite ispravnu email adresu", req.get("Referrer") || "/");
    }

    const result = await indexService.submitNewsletterForm(req.body.email, toIdArray(req.body.interests));
    logInfo("[submitNewsletter] Prijava na newsletter", { email: req.body.email, interests: req.body.interests });

    return flashAndRedirect(req, res, "success", result.message, req.get("Referrer") || "/");
  } catch (error) {
    logError("[submitNewsletter] Greška pri prijavi na newsletter", error, { email: req.body.email });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, req.get("Referrer") || "/");
    }
    next(error);
  }
}

export async function unsubscribeNewsletter(req, res, next) {
  try {
    const result = await indexService.unsubscribeNewsletter(req.params.token);
    return flashAndRedirect(req, res, "success", result.message, "/");
  } catch (error) {
    logError("[unsubscribeNewsletter] Greška pri odjavi sa newsletter-a", error, { token: req.params.token });
    return flashAndRedirect(req, res, "error", error.message || "Nevažeći link za odjavu.", "/");
  }
}

export default {
  homePage,
  aboutPage,
  partnershipPage,
  privacyPage,
  termsPage,
  faqPage,
  contactPage,
  submitContact,
  submitTestimonial,
  submitNewsletter,
  unsubscribeNewsletter,
};