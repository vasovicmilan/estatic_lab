import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { requireImageDescIfUploaded } from "./helpers/image-desc.validator.js";
import { isJsonArrayOrArray, slugField, booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

export const validatePackageCreate = [
  body("name")
    .trim()
    .notEmpty().withMessage("Naziv paketa je obavezan")
    .isLength({ min: 2, max: 150 }).withMessage("Naziv mora imati između 2 i 150 karaktera"),

  slugField(true),

  body("description")
    .trim()
    .notEmpty().withMessage("Opis je obavezan"),

  body("items")
    .notEmpty().withMessage("Paket mora sadržati bar jednu uslugu")
    .custom(isJsonArrayOrArray).withMessage("Stavke paketa nisu u ispravnom formatu"),

  body("totalPrice")
    .notEmpty().withMessage("Cena je obavezna")
    .isFloat({ min: 0 }).withMessage("Cena mora biti pozitivan broj"),

  body("basePrice")
    .optional({ values: "falsy" })
    .isFloat({ min: 0 }).withMessage("Stara cena mora biti pozitivan broj"),

  booleanishField("isBest", true),

  booleanishField("isActive", true),

  body("imageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFiles?.packageImage)),

  collectValidationErrors,
];

export const validatePackageUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 }).withMessage("Naziv mora imati između 2 i 150 karaktera"),

  slugField(false),

  body("items")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Stavke paketa nisu u ispravnom formatu"),

  body("totalPrice")
    .optional()
    .isFloat({ min: 0 }).withMessage("Cena mora biti pozitivan broj"),

  booleanishField("isActive", true),

  body("imageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFiles?.packageImage)),

  collectValidationErrors,
];

export const validatePackageId = mongoIdParamValidator("packageId", "paketa");

export default { validatePackageCreate, validatePackageUpdate, validatePackageId };