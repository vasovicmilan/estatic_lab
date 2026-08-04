import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { booleanishField, mongoIdParamValidator } from "./helpers/common.validator.js";

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

  booleanishField("isActive"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Napomena može imati najviše 500 karaktera"),

  body("googleCalendarId")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 255 }).withMessage("Google Calendar ID je predugačak")
    // covers both shapes we actually issue: a dedicated calendar id
    // (xxxx@group.calendar.google.com) and a plain email address for someone's
    // primary calendar - anything else is almost certainly a paste mistake
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).withMessage("Google Calendar ID mora izgledati kao email adresa ili x@group.calendar.google.com"),

  body("sredimeIcsUrl")
    .optional({ values: "falsy" })
    .trim()
    .isURL({ protocols: ["https"], require_protocol: true }).withMessage("Adresa mora biti validan https:// link")
    .isLength({ max: 1000 }).withMessage("Adresa je predugačka"),

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

  booleanishField("isActive"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Napomena može imati najviše 500 karaktera"),

  body("googleCalendarId")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 255 }).withMessage("Google Calendar ID je predugačak")
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).withMessage("Google Calendar ID mora izgledati kao email adresa ili x@group.calendar.google.com"),

  body("sredimeIcsUrl")
    .optional({ values: "falsy" })
    .trim()
    .isURL({ protocols: ["https"], require_protocol: true }).withMessage("Adresa mora biti validan https:// link")
    .isLength({ max: 1000 }).withMessage("Adresa je predugačka"),

  collectValidationErrors,
];

export const validateWorkingHoursUpdate = [...workingHoursValidators, collectValidationErrors];

export const validateEmployeeId = mongoIdParamValidator("employeeId", "zaposlenog");

export default {
  validateEmployeeCreate,
  validateEmployeeUpdate,
  validateWorkingHoursUpdate,
  validateEmployeeId,
};