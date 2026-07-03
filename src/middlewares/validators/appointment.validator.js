import { body, param } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";

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

export const validateAppointmentId = [
  param("appointmentId").isMongoId().withMessage("Neispravan ID termina"),
  collectValidationErrors,
];

export default {
  validateAppointmentReject,
  validateAppointmentCancel,
  validateAppointmentReassign,
  validateAppointmentId,
};