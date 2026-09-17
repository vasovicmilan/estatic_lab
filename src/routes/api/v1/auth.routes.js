import { Router } from "express";
import * as AuthController from "../../../controllers/api/v1/auth.controller.js";
import { validateRegister, validateLogin, validateRequestPasswordReset, validateResetPassword } from "../../../middlewares/validators/auth.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";
import { apiAuthLimiter } from "../../../middlewares/rate-limiter.middleware.js";

const router = Router();

// validateRegister/validateLogin/etc are the exact same express-validator rule
// arrays the web auth routes use - only the terminal step differs
// (handleApiValidationErrors instead of the web flow re-rendering a form).
router.post("/registracija", validateRegister, handleApiValidationErrors, AuthController.register);
// apiAuthLimiter (10 attempts / 15min, already wired for exactly this - see
// rate-limiter.middleware.js) on top of login specifically, not just the general
// apiLimiter every /api/v1 route gets - brute-forcing a password deserves a
// tighter, dedicated ceiling.
router.post("/prijava", apiAuthLimiter, validateLogin, handleApiValidationErrors, AuthController.login);
router.post("/zaboravljena-lozinka", validateRequestPasswordReset, handleApiValidationErrors, AuthController.requestPasswordReset);
router.put("/resetovanje-lozinke/:token", validateResetPassword, handleApiValidationErrors, AuthController.resetPassword);
router.get("/verifikacija/:token", AuthController.verifyAccount);

router.get("/ja", apiAuthMiddleware, AuthController.me);

export default router;
