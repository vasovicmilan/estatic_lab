import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { requireImageDescIfUploaded } from "./helpers/image-desc.validator.js";
import { isJsonArrayOrArray, isArrayOrString, slugField, booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

export const validateServiceCreate = [
  body("name")
    .trim()
    .notEmpty().withMessage("Naziv usluge je obavezan")
    .isLength({ min: 2, max: 150 }).withMessage("Naziv mora imati između 2 i 150 karaktera"),

  slugField(true),

  body("shortDescription")
    .optional()
    .trim()
    .isLength({ max: 300 }).withMessage("Kratak opis može imati najviše 300 karaktera"),

  body("categories")
    .optional()
    .custom(isArrayOrString).withMessage("Neispravne kategorije"),

  body("tags")
    .optional()
    .custom(isArrayOrString).withMessage("Neispravni tagovi"),

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

  booleanishField("highlight", true),

  booleanishField("isActive", true),

  body("imageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFiles?.serviceImage)),

  collectValidationErrors,
];

export const validateServiceUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 }).withMessage("Naziv mora imati između 2 i 150 karaktera"),

  slugField(false),

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

  booleanishField("highlight", true),

  booleanishField("isActive", true),

  body("imageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFiles?.serviceImage)),

  collectValidationErrors,
];

export const validateServiceSeo = [
  body("seoKeywords")
    .optional(),
  collectValidationErrors,
];

export const validateServiceId = mongoIdParamValidator("serviceId", "usluge");

export default { validateServiceCreate, validateServiceUpdate, validateServiceSeo, validateServiceId };