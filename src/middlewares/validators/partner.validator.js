import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

export const validatePartnerCreate = [
  body("userId")
    .notEmpty().withMessage("Korisnik je obavezan")
    .isMongoId().withMessage("Neispravan ID korisnika"),

  body("commissionRateServices")
    .notEmpty().withMessage("Procenat provizije za usluge/pakete je obavezan")
    .isFloat({ min: 0, max: 100 }).withMessage("Procenat provizije za usluge/pakete mora biti između 0 i 100"),

  body("commissionRateProducts")
    .notEmpty().withMessage("Procenat provizije za artikle je obavezan")
    .isFloat({ min: 0, max: 100 }).withMessage("Procenat provizije za artikle mora biti između 0 i 100"),

  body("maxCommissionAmountServices")
    .optional({ values: "falsy" })
    .isFloat({ min: 0 }).withMessage("Maksimalan iznos provizije za usluge/pakete mora biti pozitivan broj"),

  body("maxCommissionAmountProducts")
    .optional({ values: "falsy" })
    .isFloat({ min: 0 }).withMessage("Maksimalan iznos provizije za artikle mora biti pozitivan broj"),

  booleanishField("isActive"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Napomena može imati najviše 500 karaktera"),

  collectValidationErrors,
];

export const validatePartnerUpdate = [
  body("commissionRateServices")
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage("Procenat provizije za usluge/pakete mora biti između 0 i 100"),

  body("commissionRateProducts")
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage("Procenat provizije za artikle mora biti između 0 i 100"),

  body("maxCommissionAmountServices")
    .optional({ values: "falsy" })
    .isFloat({ min: 0 }).withMessage("Maksimalan iznos provizije za usluge/pakete mora biti pozitivan broj"),

  body("maxCommissionAmountProducts")
    .optional({ values: "falsy" })
    .isFloat({ min: 0 }).withMessage("Maksimalan iznos provizije za artikle mora biti pozitivan broj"),

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