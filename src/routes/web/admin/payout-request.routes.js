import { Router } from "express";
import * as PayoutRequestController from "../../../controllers/web/admin/marketing/payout-request.controller.js";
import { mongoIdParamValidator } from "../../../middlewares/validators/helpers/common.validator.js";

const router = Router();

const validateRequestId = mongoIdParamValidator("requestId", "zahteva za isplatu");

router.get("/", PayoutRequestController.listPayoutRequests);
router.get("/detalji/:requestId", validateRequestId, PayoutRequestController.payoutRequestDetails);

router.put("/:requestId/odobri", validateRequestId, PayoutRequestController.approvePayoutRequest);
router.put("/:requestId/isplati", validateRequestId, PayoutRequestController.markPayoutRequestPaid);
router.put("/:requestId/odbij", validateRequestId, PayoutRequestController.rejectPayoutRequest);

export default router;