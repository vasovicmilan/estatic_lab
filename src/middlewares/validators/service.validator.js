import { body, param } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { requireImageDescIfUploaded } from "./helpers/image-desc.validator.js";

function isJsonArrayOrArray(value) {
  if (Array.isArray(value)) return true;
  if (typeof value !== "string") return false;
  try {
    return Array.isArray(JSON.parse(value));
  } catch {
    return false;
  }
}

export const validateServiceCreate = [
  body("name")
    .trim()
    .notEmpty().withMessage("Naziv usluge je obavezan")
    .isLength({ min: 2, max: 150 }).withMessage("Naziv mora imati između 2 i 150 karaktera"),

  body("slug")
    .optional({ values: "falsy" })
    .trim()
    .matches(/^[a-z0-9-]+$/).withMessage("Slug može sadržati samo mala slova, brojeve i crtice"),

  body("shortDescription")
    .optional()
    .trim()
    .isLength({ max: 300 }).withMessage("Kratak opis može imati najviše 300 karaktera"),

  body("categories")
    .optional()
    .custom((value) => Array.isArray(value) || typeof value === "string").withMessage("Neispravne kategorije"),

  body("tags")
    .optional()
    .custom((value) => Array.isArray(value) || typeof value === "string").withMessage("Neispravni tagovi"),

  body("defaultDuration")
    .optional()
    .isInt({ min: 5 }).withMessage("Trajanje mora biti najmanje 5 minuta"),

  body("ctaText")
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage("CTA tekst može imati najviše 50 karaktera"),

  body("packages")
    .notEmpty().withMessage("Usluga mora imati bar jednu varijantu")
    .custom(isJsonArrayOrArray).withMessage("Varijante nisu u ispravnom formatu"),

  body("features")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Karakteristike nisu u ispravnom formatu"),

  body("comparisonTable")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Tabela poređenja nije u ispravnom formatu"),

  body("faq")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("FAQ nije u ispravnom formatu"),

  body("highlight")
    .optional()
    .isIn(["true", "false", true, false, "on"]).withMessage("Neispravna vrednost"),

  body("isActive")
    .optional()
    .isIn(["true", "false", true, false, "on"]).withMessage("Neispravna vrednost"),

  body("imageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFiles?.serviceImage)),

  collectValidationErrors,
];

export const validateServiceUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 }).withMessage("Naziv mora imati između 2 i 150 karaktera"),

  body("slug")
    .optional()
    .trim()
    .matches(/^[a-z0-9-]+$/).withMessage("Slug može sadržati samo mala slova, brojeve i crtice"),

  body("defaultDuration")
    .optional()
    .isInt({ min: 5 }).withMessage("Trajanje mora biti najmanje 5 minuta"),

  body("packages")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Varijante nisu u ispravnom formatu"),

  body("features")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Karakteristike nisu u ispravnom formatu"),

  body("comparisonTable")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Tabela poređenja nije u ispravnom formatu"),

  body("faq")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("FAQ nije u ispravnom formatu"),

  body("highlight")
    .optional()
    .isIn(["true", "false", true, false, "on"]).withMessage("Neispravna vrednost"),

  body("isActive")
    .optional()
    .isIn(["true", "false", true, false, "on"]).withMessage("Neispravna vrednost"),

  body("imageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFiles?.serviceImage)),

  collectValidationErrors,
];

export const validateServiceSeo = [
  body("seoKeywords")
    .optional(),
  collectValidationErrors,
];

export const validateServiceId = [
  param("serviceId").isMongoId().withMessage("Neispravan ID usluge"),
  collectValidationErrors,
];

export default { validateServiceCreate, validateServiceUpdate, validateServiceSeo, validateServiceId };