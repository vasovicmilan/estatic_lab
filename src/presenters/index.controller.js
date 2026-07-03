import * as indexService from "../../services/index.service.js";
import { prepareHomeData } from "../../presenters/public/index.presenter.js";
import { logError, logWarn, logInfo } from "../../utils/logger.util.js";
import { flashAndRedirect } from "../../utils/flash.util.js";

export async function homePage(req, res, next) {
  try {
    const serviceData = await indexService.getLandingPageData();
    const viewData = prepareHomeData(serviceData);

    return res.render("landing/home", {
      pageTitle: serviceData.seo.pageTitle,
      pageDescription: serviceData.seo.pageDescription,
      data: viewData,
    });
  } catch (error) {
    logError("[homePage] Greška pri učitavanju početne strane", error);
    next(error);
  }
}

export async function aboutPage(req, res, next) {
  try {
    const serviceData = await indexService.getAboutPageData();
    return res.render("public/_page", {
      pageTitle: serviceData.seo.pageTitle,
      pageDescription: serviceData.seo.pageDescription,
      data: {},
    });
  } catch (error) {
    logError("[aboutPage] Greška pri učitavanju stranice o nama", error);
    next(error);
  }
}

export async function privacyPage(req, res, next) {
  try {
    const serviceData = await indexService.getPrivacyPolicyPageData();
    return res.render("public/_page", {
      pageTitle: serviceData.seo.pageTitle,
      pageDescription: serviceData.seo.pageDescription,
      data: {},
    });
  } catch (error) {
    logError("[privacyPage] Greška pri učitavanju politike privatnosti", error);
    next(error);
  }
}

export async function termsPage(req, res, next) {
  try {
    const serviceData = await indexService.getTermsAndConditionsPageData();
    return res.render("public/_page", {
      pageTitle: serviceData.seo.pageTitle,
      pageDescription: serviceData.seo.pageDescription,
      data: {},
    });
  } catch (error) {
    logError("[termsPage] Greška pri učitavanju uslova korišćenja", error);
    next(error);
  }
}

export async function faqPage(req, res, next) {
  try {
    const serviceData = await indexService.getFaqPageData();
    return res.render("public/_page", {
      pageTitle: serviceData.seo.pageTitle,
      pageDescription: serviceData.seo.pageDescription,
      showFaq: true,
      data: {},
    });
  } catch (error) {
    logError("[faqPage] Greška pri učitavanju FAQ stranice", error);
    next(error);
  }
}

export async function contactPage(req, res, next) {
  try {
    const serviceData = await indexService.getContactPageData();
    return res.render("public/_page", {
      pageTitle: serviceData.seo.pageTitle,
      pageDescription: serviceData.seo.pageDescription,
      showForm: true,
      data: { formData: {}, errors: {}, csrfToken: req.csrfToken?.() },
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
      const serviceData = await indexService.getContactPageData();
      return res.status(400).render("public/_page", {
        pageTitle: serviceData.seo.pageTitle,
        pageDescription: serviceData.seo.pageDescription,
        showForm: true,
        data: { formData: req.body, errors: req.validationErrors, csrfToken: req.csrfToken?.() },
      });
    }

    await indexService.submitContactForm(req.body, { ip: req.ip, userAgent: req.headers["user-agent"] });
    logInfo("[submitContact] Kontakt poruka poslata", { email: req.body.email });

    return flashAndRedirect(req, res, "success", "Vaša poruka je uspešno poslata. Odgovorićemo vam u najkraćem roku.", "/kontakt");
  } catch (error) {
    logError("[submitContact] Greška pri slanju kontakt poruke", error, { body: req.body });

    if (error.statusCode === 400) {
      const serviceData = await indexService.getContactPageData();
      return res.status(400).render("public/_page", {
        pageTitle: serviceData.seo.pageTitle,
        pageDescription: serviceData.seo.pageDescription,
        showForm: true,
        data: { formData: req.body, errors: { general: error.message }, csrfToken: req.csrfToken?.() },
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

    const result = await indexService.submitNewsletterForm(req.body.email);
    logInfo("[submitNewsletter] Prijava na newsletter", { email: req.body.email });

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
  privacyPage,
  termsPage,
  faqPage,
  contactPage,
  submitContact,
  submitTestimonial,
  submitNewsletter,
  unsubscribeNewsletter,
};