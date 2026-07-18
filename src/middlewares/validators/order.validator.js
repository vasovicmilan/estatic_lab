import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { mongoIdParamValidator } from "./helpers/common.validator.js";

export const validateOrderCancel = [
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Razlog može imati najviše 500 karaktera"),

  collectValidationErrors,
];

export const validateOrderReturn = [
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Razlog može imati najviše 500 karaktera"),

  collectValidationErrors,
];

export const validateOrderContactUpdate = [
  body("phone")
    .optional()
    .trim()
    .isLength({ min: 6, max: 30 }).withMessage("Neispravan broj telefona"),

  body("address.city")
    .optional()
    .trim()
    .notEmpty().withMessage("Grad je obavezan"),

  body("address.postalCode")
    .optional()
    .trim()
    .notEmpty().withMessage("Poštanski broj je obavezan"),

  body("address.street")
    .optional()
    .trim()
    .notEmpty().withMessage("Ulica je obavezna"),

  body("address.number")
    .optional()
    .trim()
    .notEmpty().withMessage("Broj je obavezan"),

  collectValidationErrors,
];

export const validateOrderId = mongoIdParamValidator("orderId", "porudžbine");

export default {
  validateOrderCancel,
  validateOrderReturn,
  validateOrderContactUpdate,
  validateOrderId,
};