import { Router } from "express";
import { partnerMiddleware } from "../../middlewares/partner.middleware.js";
import * as PartnerAccountController from "../../controllers/web/partner/partner-account.controller.js";
import { validatePayoutRequest } from "../../middlewares/validators/payout-request.validator.js";

const router = Router();

// mounted at /moj-partner-nalog in web.routes.js - partnerMiddleware lives here
// (not in web.routes.js) so this router is self-contained, same convention as
// employee.routes.js's own employeeMiddleware placement
router.use(partnerMiddleware);

router.get("/", PartnerAccountController.dashboard);
router.get("/provizije", PartnerAccountController.commissions);
router.post("/isplata", validatePayoutRequest, PartnerAccountController.requestPayout);
router.get("/katalog", PartnerAccountController.catalog);

export default router;