import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";
import { mongoIdParamValidator } from "./helpers/common.validator.js";

export const validateAppointmentReject = [
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Razlog može imati najviše 500 karaktera"),

  collectValidationErrors,
];

export const validateAppointmentNoShow = [
  body("note")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Napomena može imati najviše 500 karaktera"),

  collectValidationErrors,
];

export const validateAppointmentCancel = [
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage("Razlog može imati najviše 500 karaktera"),

  collectValidationErrors,
];

export const validateAppointmentReassign = [
  body("employeeId")
    .notEmpty().withMessage("Zaposleni je obavezan")
    .isMongoId().withMessage("Neispravan ID zaposlenog"),

  collectValidationErrors,
];

export const validateAppointmentReschedule = [
  body("newStartTime")
    .notEmpty().withMessage("Novo vreme je obavezno")
    .isISO8601().withMessage("Neispravan format vremena")
    .toDate(),

  collectValidationErrors,
];

export const validateAppointmentId = mongoIdParamValidator("appointmentId", "termina");

export const validateManualAppointmentCreate = [
  body("serviceId").notEmpty().withMessage("Usluga je obavezna").isMongoId().withMessage("Neispravan ID usluge"),
  body("servicePackageId").notEmpty().withMessage("Varijanta je obavezna").isMongoId().withMessage("Neispravan ID varijante"),
  body("employeeId").optional({ checkFalsy: true }).isMongoId().withMessage("Neispravan ID zaposlenog"),
  body("startTime").notEmpty().withMessage("Datum i vreme su obavezni").isISO8601().withMessage("Neispravan format vremena"),
  body("existingUserId").optional({ checkFalsy: true }).isMongoId().withMessage("Neispravan ID korisnika"),
  // firstName/email are conditionally required client-side (see
  // admin-manual-appointment.js) depending on whether an existing user was
  // picked - not enforced strictly here, since createManualAppointment itself
  // falls back to the selected user's own contact info when these are blank,
  // and still throws its own clear error if truly nothing is available.
  body("firstName").optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage("Ime može imati najviše 100 karaktera"),
  body("lastName").optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage("Prezime može imati najviše 100 karaktera"),
  body("email").optional({ checkFalsy: true }).trim().isEmail().withMessage("Neispravna email adresa"),
  body("phone").optional({ checkFalsy: true }).trim().isLength({ max: 30 }).withMessage("Neispravan broj telefona"),
  body("note").optional({ checkFalsy: true }).trim().isLength({ max: 1000 }).withMessage("Napomena može imati najviše 1000 karaktera"),
  body("priceOverride")
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 }).withMessage("Cena mora biti pozitivan broj"),

  collectValidationErrors,
];

export default {
  validateAppointmentReject,
  validateAppointmentNoShow,
  validateAppointmentCancel,
  validateAppointmentReassign,
  validateAppointmentReschedule,
  validateAppointmentId,
  validateManualAppointmentCreate,
};