import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { mongoIdParamValidator } from "./helpers/common.validator.js";

export const validateContactCreate = [
  body("firstName")
    .trim()
    .notEmpty().withMessage("Ime je obavezno")
    .isLength({ min: 2, max: 50 }).withMessage("Ime mora imati između 2 i 50 karaktera"),

  body("lastName")
    .trim()
    .notEmpty().withMessage("Prezime je obavezno")
    .isLength({ min: 2, max: 50 }).withMessage("Prezime mora imati između 2 i 50 karaktera"),

  body("email")
    .trim()
    .notEmpty().withMessage("Email je obavezan")
    .isEmail().withMessage("Neispravan email format")
    .normalizeEmail({ gmail_remove_dots: false }),

  body("phone")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 30 }).withMessage("Telefon nije validan"),

  body("topic")
    .optional()
    .trim()
    .isLength({ max: 150 }).withMessage("Tema može imati najviše 150 karaktera"),

  body("message")
    .trim()
    .notEmpty().withMessage("Poruka je obavezna")
    .isLength({ min: 10, max: 5000 }).withMessage("Poruka mora imati između 10 i 5000 karaktera"),

  body("consent")
    .custom((value) => value === true || value === "true" || value === "on")
    .withMessage("Morate prihvatiti uslove korišćenja"),

  collectValidationErrors,
];

export const validateContactStatus = [
  body("status")
    .trim()
    .notEmpty().withMessage("Status je obavezan")
    .isIn(["new", "read", "replied", "archived"]).withMessage("Status mora biti: new, read, replied ili archived"),

  collectValidationErrors,
];

export const validateContactId = mongoIdParamValidator("contactId", "poruke");

export default { validateContactCreate, validateContactStatus, validateContactId };