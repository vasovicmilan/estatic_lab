import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { mongoIdParamValidator } from "./helpers/common.validator.js";

export const validateNewsletterSubscribe = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email je obavezan")
    .isEmail().withMessage("Neispravan email format")
    .normalizeEmail({ gmail_remove_dots: false }),

  collectValidationErrors,
];

export const validateSubscriberId = mongoIdParamValidator("subscriberId", "pretplatnika");

export default { validateNewsletterSubscribe, validateSubscriberId };