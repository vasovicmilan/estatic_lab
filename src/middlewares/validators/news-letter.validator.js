import { body, param } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";

export const validateNewsletterSubscribe = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email je obavezan")
    .isEmail().withMessage("Neispravan email format")
    .normalizeEmail({ gmail_remove_dots: false }),

  collectValidationErrors,
];

export const validateSubscriberId = [
  param("subscriberId").isMongoId().withMessage("Neispravan ID pretplatnika"),
  collectValidationErrors,
];

export default { validateNewsletterSubscribe, validateSubscriberId };