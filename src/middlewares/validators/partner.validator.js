import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

export const validatePartnerCreate = [
  body("userId")
    .notEmpty().withMessage("Korisnik je obavezan")
    .isMongoId().withMessage("Neispravan ID korisnika"),

  body("commissionRate")
    .notEmpty().withMessage("Procenat provizije je obavezan")
    .isFloat({ min: 0, max: 100 }).withMessage("Procenat provizije mora biti između 0 i 100"),

  booleanishField("isActive"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Napomena može imati najviše 500 karaktera"),

  collectValidationErrors,
];

export const validatePartnerUpdate = [
  body("commissionRate")
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage("Procenat provizije mora biti između 0 i 100"),

  booleanishField("isActive"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Napomena može imati najviše 500 karaktera"),

  collectValidationErrors,
];

export const validatePartnerId = mongoIdParamValidator("partnerId", "partnera");

export default {
  validatePartnerCreate,
  validatePartnerUpdate,
  validatePartnerId,
};