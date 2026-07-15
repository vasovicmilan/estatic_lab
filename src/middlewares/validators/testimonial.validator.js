import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

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

  body("package")
    .optional({ values: "falsy" })
    .isMongoId().withMessage("Neispravan paket"),

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
  booleanishField("isFeatured", true),

  collectValidationErrors,
];

export const validateTestimonialId = mongoIdParamValidator("testimonialId", "testimonijala");

export default { validateTestimonialSubmit, validateTestimonialApprove, validateTestimonialId };