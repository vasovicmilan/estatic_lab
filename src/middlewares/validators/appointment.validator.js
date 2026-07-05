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

export const validateAppointmentId = mongoIdParamValidator("appointmentId", "termina");

export default {
  validateAppointmentReject,
  validateAppointmentCancel,
  validateAppointmentReassign,
  validateAppointmentId,
};