import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { mongoIdParamValidator } from "./helpers/common.validator.js";

export const validateCreatePackagePurchase = [
  body("userId")
    .notEmpty().withMessage("Korisnik je obavezan")
    .isMongoId().withMessage("Neispravan ID korisnika"),

  body("packageId")
    .notEmpty().withMessage("Paket je obavezan")
    .isMongoId().withMessage("Neispravan ID paketa"),

  body("expiresAt")
    .optional({ values: "falsy" })
    .isISO8601().withMessage("Neispravan datum isteka"),

  body("pricePaid")
    .optional({ values: "falsy" })
    .isFloat({ min: 0 }).withMessage("Cena mora biti pozitivan broj"),

  body("couponCode")
    .optional({ values: "falsy" })
    .trim(),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Napomena može imati najviše 500 karaktera"),

  collectValidationErrors,
];

export const validatePackagePurchaseId = mongoIdParamValidator("packagePurchaseId", "kupljenog paketa");

export default { validateCreatePackagePurchase, validatePackagePurchaseId };