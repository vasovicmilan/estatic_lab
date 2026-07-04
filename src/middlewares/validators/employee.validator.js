import { body, param } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";

const WEEK_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const workingHoursValidators = [
  body("workingHours")
    .optional()
    .isArray().withMessage("Radno vreme mora biti niz"),

  body("workingHours.*.day")
    .optional()
    .isIn(WEEK_DAYS).withMessage("Neispravan dan u nedelji"),

  body("workingHours.*.slots")
    .optional()
    .isArray().withMessage("Termini moraju biti niz"),

  body("workingHours.*.slots.*.from")
    .optional()
    .matches(TIME_RE).withMessage("Neispravan format vremena (očekivano HH:MM)"),

  body("workingHours.*.slots.*.to")
    .optional()
    .matches(TIME_RE).withMessage("Neispravan format vremena (očekivano HH:MM)"),
];

export const validateEmployeeCreate = [
  body("userId")
    .notEmpty().withMessage("Korisnik je obavezan")
    .isMongoId().withMessage("Neispravan ID korisnika"),

  body("expert")
    .optional({ values: "falsy" })
    .isMongoId().withMessage("Neispravan ID eksperta"),

  body("services")
    .optional()
    .isArray().withMessage("Usluge moraju biti niz"),

  body("services.*")
    .optional()
    .isMongoId().withMessage("Neispravan ID usluge"),

  ...workingHoursValidators,

  body("isActive")
    .optional()
    .isIn(["true", "false", true, false]).withMessage("Neispravna vrednost"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Napomena može imati najviše 500 karaktera"),

  collectValidationErrors,
];

export const validateEmployeeUpdate = [
  body("expert")
    .optional({ values: "falsy" })
    .isMongoId().withMessage("Neispravan ID eksperta"),

  body("services")
    .optional()
    .isArray().withMessage("Usluge moraju biti niz"),

  body("services.*")
    .optional()
    .isMongoId().withMessage("Neispravan ID usluge"),

  ...workingHoursValidators,

  body("isActive")
    .optional()
    .isIn(["true", "false", true, false]).withMessage("Neispravna vrednost"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Napomena može imati najviše 500 karaktera"),

  collectValidationErrors,
];

export const validateWorkingHoursUpdate = [...workingHoursValidators, collectValidationErrors];

export const validateEmployeeId = [
  param("employeeId").isMongoId().withMessage("Neispravan ID zaposlenog"),
  collectValidationErrors,
];

export default {
  validateEmployeeCreate,
  validateEmployeeUpdate,
  validateWorkingHoursUpdate,
  validateEmployeeId,
};
