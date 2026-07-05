import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { requireImageDescIfUploaded } from "./helpers/image-desc.validator.js";
import { isJsonArrayOrArray, isArrayOrString, slugField, booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

export const validatePostCreate = [
  body("title")
    .trim()
    .notEmpty().withMessage("Naslov je obavezan")
    .isLength({ min: 2, max: 200 }).withMessage("Naslov mora imati između 2 i 200 karaktera"),

  slugField(true),

  body("excerpt")
    .trim()
    .notEmpty().withMessage("Kratak opis je obavezan")
    .isLength({ max: 300 }).withMessage("Kratak opis može imati najviše 300 karaktera"),

  body("content")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Sadržaj nije u ispravnom formatu"),

  body("categories")
    .optional()
    .custom(isArrayOrString).withMessage("Neispravne kategorije"),

  body("tags")
    .optional()
    .custom(isArrayOrString).withMessage("Neispravni tagovi"),

  body("author")
    .optional()
    .isMongoId().withMessage("Neispravan autor"),

  body("status")
    .optional()
    .isIn(["draft", "published", "archived"]).withMessage("Neispravan status"),

  booleanishField("isIndexable", true),

  body("coverImageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFiles?.coverImage)),

  collectValidationErrors,
];

export const validatePostUpdate = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 }).withMessage("Naslov mora imati između 2 i 200 karaktera"),

  slugField(false),

  body("excerpt")
    .optional()
    .trim()
    .isLength({ max: 300 }).withMessage("Kratak opis može imati najviše 300 karaktera"),

  body("content")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Sadržaj nije u ispravnom formatu"),

  body("status")
    .optional()
    .isIn(["draft", "published", "archived"]).withMessage("Neispravan status"),

  body("coverImageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFiles?.coverImage)),

  collectValidationErrors,
];

export const validatePostStatus = [
  body("status")
    .trim()
    .notEmpty().withMessage("Status je obavezan")
    .isIn(["draft", "published", "archived"]).withMessage("Neispravan status"),

  collectValidationErrors,
];

export const validatePostSeo = [
  body("seoTitle")
    .optional()
    .trim()
    .isLength({ max: 70 }).withMessage("SEO naslov može imati najviše 70 karaktera"),

  body("seoDescription")
    .optional()
    .trim()
    .isLength({ max: 160 }).withMessage("SEO opis može imati najviše 160 karaktera"),

  collectValidationErrors,
];

export const validatePostId = mongoIdParamValidator("postId", "posta");

export default { validatePostCreate, validatePostUpdate, validatePostStatus, validatePostSeo, validatePostId };