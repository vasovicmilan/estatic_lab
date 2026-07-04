import { validationResult } from "express-validator";

export function collectValidationErrors(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = {};

    errors.array().forEach((error) => {
      const field = error.path || error.param || "general";

      if (formattedErrors[field]) {
        if (Array.isArray(formattedErrors[field])) {
          formattedErrors[field].push(error.msg);
        } else {
          formattedErrors[field] = [formattedErrors[field], error.msg];
        }
      } else {
        formattedErrors[field] = error.msg;
      }
    });

    req.validationErrors = formattedErrors;
  }

  next();
}
