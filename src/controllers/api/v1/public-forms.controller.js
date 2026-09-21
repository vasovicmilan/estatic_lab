import * as indexService from "../../../services/index.service.js";
import { getCapturedReferralCode } from "../../../middlewares/coupon-capture.middleware.js";
import { logError, logInfo } from "../../../utils/logger.util.js";

// Gap fix: the web app has always had these three public submission forms
// (kontakt, newsletter prijava, testimonial slanje - see web.routes.js and
// index.controller.js's submitContact/submitNewsletter/submitTestimonial),
// but API v1 never got JSON equivalents - only the ADMIN side of each
// (listContacts/listSubscribers/listTestimonials + approve/reject) exists in
// admin-marketing.controller.js. That's a real gap for the Angular frontend:
// there was no way for a site visitor to actually submit a contact message,
// subscribe to the newsletter, or leave a testimonial through the API.
//
// Each function below reuses the exact same service-layer function the web
// controller already calls (indexService.submitContactForm/submitTestimonialForm/
// submitNewsletterForm), so validation rules, spam/consent handling, and
// notification side-effects (e.g. admin email on new contact message) are
// identical to the existing web flow - this is a routing/response-shape
// addition only, no new business logic.

export async function submitContact(req, res, next) {
  try {
    const { firstName, lastName, email, phone, topic, message } = req.body;
    const referralCode = req.body.arrivedWithTema === "1" ? getCapturedReferralCode(req) : null;

    await indexService.submitContactForm(
      { firstName, lastName, email, phone, topic, message },
      { ip: req.ip, userAgent: req.headers["user-agent"], referralCode }
    );

    logInfo("[api/submitContact] Kontakt poruka poslata", { email });
    return res.status(201).json({ success: true, data: { message: "Vaša poruka je uspešno poslata. Odgovorićemo vam u najkraćem roku." } });
  } catch (error) {
    logError("[api/submitContact] Greška pri slanju kontakt poruke", error, { body: req.body });
    next(error);
  }
}

export async function subscribeNewsletter(req, res, next) {
  try {
    const { email, interests } = req.body;
    const interestList = Array.isArray(interests) ? interests : interests ? [interests] : [];

    const result = await indexService.submitNewsletterForm(email, interestList);
    logInfo("[api/subscribeNewsletter] Prijava na newsletter", { email, interests: interestList });
    return res.status(201).json({ success: true, data: { message: result.message } });
  } catch (error) {
    logError("[api/subscribeNewsletter] Greška pri prijavi na newsletter", error, { email: req.body.email });
    next(error);
  }
}

export async function submitTestimonial(req, res, next) {
  try {
    const data = { ...req.body };
    // optionalApiAuth is NOT used on this route (see public-forms.routes.js's
    // comment) - a testimonial can be left by a guest, same as the web form -
    // but when the caller does carry a valid Bearer token, req.user is already
    // populated by apiAuthMiddleware upstream on /me, /employee etc.; this
    // route has no auth middleware at all, so req.user is always undefined
    // here and userId is simply omitted, exactly like an anonymous web visitor
    // who isn't logged into the session.
    data.consentIpAddress = req.ip;

    const result = await indexService.submitTestimonialForm(data);
    logInfo("[api/submitTestimonial] Testimonijal poslat", { name: req.body.name });
    return res.status(201).json({ success: true, data: { message: result.message } });
  } catch (error) {
    logError("[api/submitTestimonial] Greška pri slanju testimoniala", error, { body: req.body });
    next(error);
  }
}

export default { submitContact, subscribeNewsletter, submitTestimonial };
