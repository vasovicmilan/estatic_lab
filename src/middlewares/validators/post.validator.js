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

export const validatePostCreate = [
  body("title")
    .trim()
    .notEmpty().withMessage("Naslov je obavezan")
    .isLength({ min: 2, max: 200 }).withMessage("Naslov mora imati između 2 i 200 karaktera"),

  body("slug")
    .trim()
    .notEmpty().withMessage("Slug je obavezan")
    .matches(/^[a-z0-9-]+$/).withMessage("Slug može sadržati samo mala slova, brojeve i crtice"),

  body("excerpt")
    .trim()
    .notEmpty().withMessage("Kratak opis je obavezan")
    .isLength({ max: 300 }).withMessage("Kratak opis može imati najviše 300 karaktera"),

  body("content")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Sadržaj nije u ispravnom formatu"),

  body("categories")
    .optional()
    .custom((value) => Array.isArray(value) || typeof value === "string").withMessage("Neispravne kategorije"),

  body("tags")
    .optional()
    .custom((value) => Array.isArray(value) || typeof value === "string").withMessage("Neispravni tagovi"),

  body("author")
    .optional()
    .isMongoId().withMessage("Neispravan autor"),

  body("status")
    .optional()
    .isIn(["draft", "published", "archived"]).withMessage("Neispravan status"),

  body("isIndexable")
    .optional()
    .isIn(["true", "false", true, false, "on"]).withMessage("Neispravna vrednost"),

  collectValidationErrors,
];

export const validatePostUpdate = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 }).withMessage("Naslov mora imati između 2 i 200 karaktera"),

  body("slug")
    .optional()
    .trim()
    .matches(/^[a-z0-9-]+$/).withMessage("Slug može sadržati samo mala slova, brojeve i crtice"),

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

export const validatePostId = [
  param("postId").isMongoId().withMessage("Neispravan ID posta"),
  collectValidationErrors,
];

export default { validatePostCreate, validatePostUpdate, validatePostStatus, validatePostSeo, validatePostId };