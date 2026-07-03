import { body, param } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";

function isJsonArrayOrArray(value) {
  if (Array.isArray(value)) return true;
  if (typeof value !== "string") return false;
  try {
    return Array.isArray(JSON.parse(value));
  } catch {
    return false;
  }
}

export const validatePackageCreate = [
  body("name")
    .trim()
    .notEmpty().withMessage("Naziv paketa je obavezan")
    .isLength({ min: 2, max: 150 }).withMessage("Naziv mora imati između 2 i 150 karaktera"),

  body("slug")
    .trim()
    .notEmpty().withMessage("Slug je obavezan")
    .matches(/^[a-z0-9-]+$/).withMessage("Slug može sadržati samo mala slova, brojeve i crtice"),

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

  body("isBest")
    .optional()
    .isIn(["true", "false", true, false, "on"]).withMessage("Neispravna vrednost"),

  body("isActive")
    .optional()
    .isIn(["true", "false", true, false, "on"]).withMessage("Neispravna vrednost"),

  collectValidationErrors,
];

export const validatePackageUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 }).withMessage("Naziv mora imati između 2 i 150 karaktera"),

  body("slug")
    .optional()
    .trim()
    .matches(/^[a-z0-9-]+$/).withMessage("Slug može sadržati samo mala slova, brojeve i crtice"),

  body("items")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Stavke paketa nisu u ispravnom formatu"),

  body("totalPrice")
    .optional()
    .isFloat({ min: 0 }).withMessage("Cena mora biti pozitivan broj"),

  body("isActive")
    .optional()
    .isIn(["true", "false", true, false, "on"]).withMessage("Neispravna vrednost"),

  collectValidationErrors,
];

export const validatePackageId = [
  param("packageId").isMongoId().withMessage("Neispravan ID paketa"),
  collectValidationErrors,
];

export default { validatePackageCreate, validatePackageUpdate, validatePackageId };