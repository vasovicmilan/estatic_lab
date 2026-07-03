import { Router } from "express";
import * as AuthController from "../../controllers/web/auth/auth.controller.js";
import {
  validateRegister,
  validateLogin,
  validateGoogleAuth,
  validateRequestPasswordReset,
  validateResetPassword,
} from "../../middlewares/validators/auth.validator.js";
import { loginLimiter, registerLimiter, passwordResetLimiter, verificationLimiter } from "../../middlewares/rate-limiter.middleware.js";

const router = Router();

router.get("/prijava", AuthController.loginForm);
router.post("/prijava", loginLimiter, validateLogin, AuthController.login);
router.post("/prijava/google", loginLimiter, validateGoogleAuth, AuthController.googleCallback);

router.get("/registracija", AuthController.registerForm);
router.post("/registracija", registerLimiter, validateRegister, AuthController.register);

router.get("/odjava", AuthController.logout);

router.get("/verifikacija/:token", verificationLimiter, AuthController.verifyAccount);

router.get("/zaboravljena-lozinka", AuthController.forgotPasswordForm);
router.post("/zaboravljena-lozinka", passwordResetLimiter, validateRequestPasswordReset, AuthController.requestPasswordReset);

router.get("/resetovanje-lozinke/:token", AuthController.resetPasswordForm);
router.post("/resetovanje-lozinke/:token", passwordResetLimiter, validateResetPassword, AuthController.resetPassword);
router.get("/preuzmi-nalog/:token", AuthController.resetPasswordForm);
router.post("/preuzmi-nalog/:token", passwordResetLimiter, validateResetPassword, AuthController.resetPassword);

export default router;