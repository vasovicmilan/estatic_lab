import { query } from "express-validator";
import { collectValidationErrors } from "./collect-validation-errors.js";

export const validateSearch = [
  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Pretraga može imati najviše 100 karaktera"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Stranica mora biti pozitivan broj"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit mora biti između 1 i 100"),

  collectValidationErrors,
];

export default { validateSearch };