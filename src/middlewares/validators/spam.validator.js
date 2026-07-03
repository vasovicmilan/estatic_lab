import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";

export const validateHoneypot = [
  body("nickname")
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === "") return true;
      return false;
    })
    .withMessage("Neuspešna validacija forme"),

  collectValidationErrors,
];

export default { validateHoneypot };