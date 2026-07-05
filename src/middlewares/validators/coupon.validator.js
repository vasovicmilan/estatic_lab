import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { isArrayOrString, booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

export const validateCouponCreate = [
  body("code")
    .trim()
    .notEmpty().withMessage("Kod kupona je obavezan")
    .isLength({ min: 3, max: 30 }).withMessage("Kod mora imati između 3 i 30 karaktera")
    .matches(/^[a-zA-Z0-9-_]+$/).withMessage("Kod može sadržati samo slova, brojeve, crtice i donje crte"),

  body("discountType")
    .trim()
    .notEmpty().withMessage("Tip popusta je obavezan")
    .isIn(["percentage", "fixed"]).withMessage("Tip mora biti 'percentage' ili 'fixed'"),

  body("discountValue")
    .notEmpty().withMessage("Vrednost popusta je obavezna")
    .isFloat({ min: 0 }).withMessage("Vrednost popusta mora biti pozitivan broj"),

  body("minAppointmentValue")
    .optional()
    .isFloat({ min: 0 }).withMessage("Minimalna vrednost mora biti pozitivan broj"),

  body("maxUses")
    .optional({ values: "falsy" })
    .isInt({ min: 1 }).withMessage("Maksimalan broj upotreba mora biti pozitivan broj"),

  body("maxUsesPerUser")
    .optional({ values: "falsy" })
    .isInt({ min: 1 }).withMessage("Maksimalan broj upotreba po korisniku mora biti pozitivan broj"),

  body("applicableServices")
    .optional()
    .custom(isArrayOrString).withMessage("Neispravne usluge"),

  body("validUntil")
    .notEmpty().withMessage("Datum isteka je obavezan")
    .isISO8601().withMessage("Neispravan format datuma"),

  booleanishField("isActive", true),

  collectValidationErrors,
];

export const validateCouponUpdate = [
  body("discountType")
    .optional()
    .isIn(["percentage", "fixed"]).withMessage("Tip mora biti 'percentage' ili 'fixed'"),

  body("discountValue")
    .optional()
    .isFloat({ min: 0 }).withMessage("Vrednost popusta mora biti pozitivan broj"),

  body("validUntil")
    .optional()
    .isISO8601().withMessage("Neispravan format datuma"),

  booleanishField("isActive", true),

  collectValidationErrors,
];

export const validateCouponApply = [
  body("code")
    .trim()
    .notEmpty().withMessage("Kod kupona je obavezan"),

  collectValidationErrors,
];

export const validateCouponId = mongoIdParamValidator("couponId", "kupona");

export default { validateCouponCreate, validateCouponUpdate, validateCouponApply, validateCouponId };