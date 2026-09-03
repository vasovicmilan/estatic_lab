import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { requireImageDescIfUploaded } from "./helpers/image-desc.validator.js";
import { isJsonArrayOrArray, slugField, booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

export const validateBusinessPartnerCreate = [
  body("name")
    .trim()
    .notEmpty().withMessage("Naziv je obavezan")
    .isLength({ min: 2, max: 150 }).withMessage("Naziv mora imati između 2 i 150 karaktera"),

  slugField(true),

  body("shortDescription")
    .trim()
    .notEmpty().withMessage("Kratak opis je obavezan")
    .isLength({ max: 300 }).withMessage("Kratak opis može imati najviše 300 karaktera"),

  body("content")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Sadržaj nije u ispravnom formatu"),

  body("outboundUrl")
    .trim()
    .notEmpty().withMessage("Link ka prodavnici saradnika je obavezan")
    .isURL({ require_protocol: true }).withMessage("Unesite ispravan link (uključujući https://)"),

  body("ctaLabel")
    .optional()
    .trim()
    .isLength({ max: 40 }).withMessage("Tekst dugmeta može imati najviše 40 karaktera"),

  body("address")
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage("Adresa može imati najviše 200 karaktera"),

  body("latitude")
    .optional({ values: "falsy" })
    .isFloat({ min: -90, max: 90 }).withMessage("Geografska širina mora biti između -90 i 90"),

  body("longitude")
    .optional({ values: "falsy" })
    .isFloat({ min: -180, max: 180 }).withMessage("Geografska dužina mora biti između -180 i 180"),

  booleanishField("isActive", true),

  body("coverImageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFiles?.coverImage)),

  collectValidationErrors,
];

export const validateBusinessPartnerUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 }).withMessage("Naziv mora imati između 2 i 150 karaktera"),

  slugField(false),

  body("shortDescription")
    .optional()
    .trim()
    .isLength({ max: 300 }).withMessage("Kratak opis može imati najviše 300 karaktera"),

  body("content")
    .optional()
    .custom(isJsonArrayOrArray).withMessage("Sadržaj nije u ispravnom formatu"),

  body("outboundUrl")
    .optional()
    .trim()
    .isURL({ require_protocol: true }).withMessage("Unesite ispravan link (uključujući https://)"),

  body("ctaLabel")
    .optional()
    .trim()
    .isLength({ max: 40 }).withMessage("Tekst dugmeta može imati najviše 40 karaktera"),

  body("address")
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage("Adresa može imati najviše 200 karaktera"),

  body("latitude")
    .optional({ values: "falsy" })
    .isFloat({ min: -90, max: 90 }).withMessage("Geografska širina mora biti između -90 i 90"),

  body("longitude")
    .optional({ values: "falsy" })
    .isFloat({ min: -180, max: 180 }).withMessage("Geografska dužina mora biti između -180 i 180"),

  booleanishField("isActive", true),

  body("coverImageDesc")
    .custom(requireImageDescIfUploaded((req) => req.uploadedFiles?.coverImage)),

  collectValidationErrors,
];

export const validateBusinessPartnerId = mongoIdParamValidator("partnerId", "saradnika");

export default { validateBusinessPartnerCreate, validateBusinessPartnerUpdate, validateBusinessPartnerId };
