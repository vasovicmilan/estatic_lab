import { body, param } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";

export const validateUserStatus = [
  body("status")
    .trim()
    .notEmpty().withMessage("Status je obavezan")
    .isIn(["guest", "pending", "active", "inactive", "suspended"]).withMessage("Neispravan status"),

  collectValidationErrors,
];

export const validateUserRole = [
  body("role")
    .trim()
    .notEmpty().withMessage("Rola je obavezna")
    .isMongoId().withMessage("Neispravan ID role"),

  collectValidationErrors,
];

export const validateUserId = [
  param("userId").isMongoId().withMessage("Neispravan ID korisnika"),
  collectValidationErrors,
];

export const validateProfileUpdate = [
  body("firstName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage("Ime mora imati između 2 i 50 karaktera"),

  body("lastName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage("Prezime mora imati između 2 i 50 karaktera"),

  body("phone")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 30 }).withMessage("Telefon nije validan"),

  collectValidationErrors,
];

export default { validateUserStatus, validateUserRole, validateUserId, validateProfileUpdate };
