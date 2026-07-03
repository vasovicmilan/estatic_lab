import { body, param } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";

export const validateTestimonialSubmit = [
  body("name")
    .trim()
    .notEmpty().withMessage("Ime je obavezno")
    .isLength({ min: 2, max: 100 }).withMessage("Ime mora imati između 2 i 100 karaktera"),

  body("email")
    .optional({ values: "falsy" })
    .trim()
    .isEmail().withMessage("Neispravan email format")
    .normalizeEmail({ gmail_remove_dots: false }),

  body("service")
    .optional({ values: "falsy" })
    .isMongoId().withMessage("Neispravna usluga"),

  body("rating")
    .notEmpty().withMessage("Ocena je obavezna")
    .isInt({ min: 1, max: 5 }).withMessage("Ocena mora biti između 1 i 5"),

  body("message")
    .trim()
    .notEmpty().withMessage("Komentar je obavezan")
    .isLength({ min: 10, max: 1000 }).withMessage("Komentar mora imati između 10 i 1000 karaktera"),

  collectValidationErrors,
];

export const validateTestimonialApprove = [
  body("isFeatured")
    .optional()
    .isIn(["true", "false", true, false, "on"]).withMessage("Neispravna vrednost"),

  collectValidationErrors,
];

export const validateTestimonialId = [
  param("testimonialId").isMongoId().withMessage("Neispravan ID testimonijala"),
  collectValidationErrors,
];

export default { validateTestimonialSubmit, validateTestimonialApprove, validateTestimonialId };