import { ValidationError } from "../utils/error.util.js";

// Sits right after an existing express-validator rule array + collectValidationErrors
// (e.g. validateLogin, validateRegister - reused as-is, unmodified, from the web
// validators) in an /api/v1 route chain. collectValidationErrors only ANNOTATES
// req.validationErrors and always calls next() - deciding what to do with it is left
// to the caller, because the web side needs to re-render a form with the errors
// inline. An API controller has no form to re-render, so this is that decision for
// every /api/v1 route: turn req.validationErrors into a ValidationError and hand it
// to next(), where the existing globalErrorHandler/buildApiErrorPayload renders it
// exactly like every other error in the app (same {success:false, error:{...}}
// shape) - no per-controller error formatting needed anywhere in controllers/api/v1.
export function handleApiValidationErrors(req, res, next) {
  if (req.validationErrors) {
    return next(new ValidationError("Validacija nije uspela", req.validationErrors));
  }
  next();
}
