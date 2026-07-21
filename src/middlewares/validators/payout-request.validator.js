import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";

export const validatePayoutRequest = [
  body("amount")
    .notEmpty().withMessage("Iznos je obavezan")
    .isFloat({ min: 1 }).withMessage("Iznos mora biti veći od nule"),

  collectValidationErrors,
];

export const validateDirectPayoutRecord = [
  body("earnerType")
    .isIn(["employee", "partner"]).withMessage("Nepoznat tip"),

  body("earnerId")
    .isMongoId().withMessage("Neispravan ID"),

  body("amount")
    .notEmpty().withMessage("Iznos je obavezan")
    .isFloat({ min: 1 }).withMessage("Iznos mora biti veći od nule"),

  collectValidationErrors,
];

export default { validatePayoutRequest, validateDirectPayoutRecord };