import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { mongoIdParamValidator } from "./helpers/common.validator.js";

export const validateNewsletterSubscribe = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email je obavezan")
    .isEmail().withMessage("Neispravan email format")
    .normalizeEmail({ gmail_remove_dots: false }),

  // Explicit opt-in required, separate from just submitting an email address -
  // typing an email into a field isn't itself informed consent to receive
  // marketing emails. Checked as a literal "true" string since it arrives as
  // an unchecked-checkbox-omits-the-field HTML form value, not a boolean.
  body("consent")
    .equals("true").withMessage("Morate se složiti sa primanjem newsletter-a"),

  collectValidationErrors,
];

export const validateSubscriberId = mongoIdParamValidator("subscriberId", "pretplatnika");

export default { validateNewsletterSubscribe, validateSubscriberId };