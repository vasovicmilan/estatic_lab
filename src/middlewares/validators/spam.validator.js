import { body } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";

/**
 * A hidden field (`nickname` by default) that must stay empty. Bots that blindly fill
 * every input on the page will fill this one too and get silently rejected — no
 * CAPTCHA, no extra dependency, zero friction for real visitors.
 */
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
