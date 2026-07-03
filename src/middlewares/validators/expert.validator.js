import { body, param } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";

export const validateExpertCreate = [
  body("firstName")
    .trim()
    .notEmpty().withMessage("Ime je obavezno")
    .isLength({ min: 2, max: 50 }).withMessage("Ime mora imati između 2 i 50 karaktera"),

  body("lastName")
    .trim()
    .notEmpty().withMessage("Prezime je obavezno")
    .isLength({ min: 2, max: 50 }).withMessage("Prezime mora imati između 2 i 50 karaktera"),

  body("slug")
    .trim()
    .notEmpty().withMessage("Slug je obavezan")
    .matches(/^[a-z0-9-]+$/).withMessage("Slug može sadržati samo mala slova, brojeve i crtice"),

  body("title")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Titula može imati najviše 100 karaktera"),

  body("shortBio")
    .optional()
    .trim()
    .isLength({ max: 300 }).withMessage("Kratka biografija može imati najviše 300 karaktera"),

  body("bio")
    .optional()
    .trim(),

  body("specializations")
    .optional()
    .isArray().withMessage("Specijalizacije moraju biti niz"),

  body("services")
    .optional()
    .isArray().withMessage("Usluge moraju biti niz"),

  body("services.*")
    .optional()
    .isMongoId().withMessage("Neispravan ID usluge"),

  body("isActive")
    .optional()
    .isIn(["true", "false", true, false]).withMessage("Neispravna vrednost"),

  body("order")
    .optional()
    .isInt({ min: 0 }).withMessage("Redosled mora biti pozitivan broj"),

  collectValidationErrors,
];

export const validateExpertUpdate = [
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage("Ime mora imati između 2 i 50 karaktera"),

  body("lastName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage("Prezime mora imati između 2 i 50 karaktera"),

  body("slug")
    .optional()
    .trim()
    .matches(/^[a-z0-9-]+$/).withMessage("Slug može sadržati samo mala slova, brojeve i crtice"),

  body("title")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Titula može imati najviše 100 karaktera"),

  body("services")
    .optional()
    .isArray().withMessage("Usluge moraju biti niz"),

  body("services.*")
    .optional()
    .isMongoId().withMessage("Neispravan ID usluge"),

  body("isActive")
    .optional()
    .isIn(["true", "false", true, false]).withMessage("Neispravna vrednost"),

  collectValidationErrors,
];

export const validateExpertId = [
  param("expertId").isMongoId().withMessage("Neispravan ID eksperta"),
  collectValidationErrors,
];

export default { validateExpertCreate, validateExpertUpdate, validateExpertId };