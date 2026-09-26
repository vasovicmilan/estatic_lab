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
// apiAuthLimiter (10 attempts / 15min, see rate-limiter.middleware.js) applied to
// every auth route here, not just the general apiLimiter every /api/v1 route gets -
// registration, password-reset and verification are just as brute-forceable/abusable
// as login, and the web equivalents of all of these already get their own dedicated
// limiters (see routes/web/auth.routes.js), so the API versions shouldn't be weaker.
router.post("/register", apiAuthLimiter, validateRegister, handleApiValidationErrors, AuthController.register);
router.post("/login", apiAuthLimiter, validateLogin, handleApiValidationErrors, AuthController.login);
router.post("/forgot-password", apiAuthLimiter, validateRequestPasswordReset, handleApiValidationErrors, AuthController.requestPasswordReset);
router.put("/reset-password/:token", apiAuthLimiter, validateResetPassword, handleApiValidationErrors, AuthController.resetPassword);
router.get("/verify/:token", apiAuthLimiter, AuthController.verifyAccount);

router.get("/me", apiAuthMiddleware, AuthController.me);

export default router;
