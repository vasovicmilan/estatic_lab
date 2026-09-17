import { Router } from "express";
import * as PartnerController from "../../../controllers/api/v1/partner.controller.js";
import { validatePayoutRequest } from "../../../middlewares/validators/payout-request.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";
import { partnerMiddleware } from "../../../middlewares/partner.middleware.js";

const router = Router();

// partnerMiddleware already reads req.user (not req.session.user) - gates a
// Bearer-token request the same way it gates a session one, on req.user.isPartner.
router.use(apiAuthMiddleware, partnerMiddleware);

router.get("/dashboard", PartnerController.dashboard);
router.get("/commissions", PartnerController.listCommissions);
router.get("/payouts", PartnerController.listPayouts);
router.post("/payouts", validatePayoutRequest, handleApiValidationErrors, PartnerController.requestPayout);
router.get("/catalog", PartnerController.catalog);

export default router;
