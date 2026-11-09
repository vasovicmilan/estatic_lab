import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { requireImageDescIfUploaded } from "./helpers/image-desc.validator.js";
import { slugField, booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

// HTML forms send a lone value as a string and an empty multi-select as "" -
// normalize to an array of non-empty values before isArray()/isMongoId() run.
const normalizeToArray = (value) => {
  if (value === undefined || value === null) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.filter((v) => v !== "" && v !== null && v !== undefined);
};

export const validateExpertCreate = [
  body("firstName")
    .trim()
    .notEmpty().withMessage("Ime je obavezno")
    .isLength({ min: 2, max: 50 }).withMessage("Ime mora imati između 2 i 50 karaktera"),

  body("lastName")
    .trim()
    .notEmpty().withMessage("Prezime je obavezno")
    .isLength({ min: 2, max: 50 }).withMessage("Prezime mora imati između 2 i 50 karaktera"),

  slugField(true),

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
    .customSanitizer(normalizeToArray)
    .isArray().withMessage("Usluge moraju biti niz"),

  body("services.*")
    .optional()
    .isMongoId().withMessage("Neispravan ID usluge"),

  booleanishField("isActive"),

  body("order")
    .optional()
    .isInt({ min: 0 }).withMessage("Redosled mora biti pozitivan broj"),

  body("imageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFile)),

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

  slugField(false),

  body("title")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("Titula može imati najviše 100 karaktera"),

  body("services")
    .optional()
    .customSanitizer(normalizeToArray)
    .isArray().withMessage("Usluge moraju biti niz"),

  body("services.*")
    .optional()
    .isMongoId().withMessage("Neispravan ID usluge"),

  booleanishField("isActive"),

  body("imageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFile)),

  collectValidationErrors,
];

export const validateExpertId = mongoIdParamValidator("expertId", "eksperta");

export default { validateExpertCreate, validateExpertUpdate, validateExpertId };