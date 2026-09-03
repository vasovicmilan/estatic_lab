import { Router } from "express";
import * as BusinessPartnerController from "../../../controllers/web/admin/marketing/business-partner.controller.js";
import {
  validateBusinessPartnerCreate,
  validateBusinessPartnerUpdate,
  validateBusinessPartnerId,
} from "../../../middlewares/validators/business-partner.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";
import { csrfAfterMulter } from "../../../config/csrf.config.js";
import { processMultipleUploads } from "../../../config/multer.config.js";

const router = Router();

const partnerUploads = processMultipleUploads([{ name: "coverImage", maxCount: 1, type: "partners" }]);

router.get("/", validateSearch, BusinessPartnerController.listBusinessPartners);
router.get("/dodavanje", BusinessPartnerController.newBusinessPartnerForm);
router.get("/detalji/:partnerId", validateBusinessPartnerId, BusinessPartnerController.businessPartnerDetails);
router.get("/izmena/:partnerId", validateBusinessPartnerId, BusinessPartnerController.editBusinessPartnerForm);

router.post(
  "/",
  ...partnerUploads,
  csrfAfterMulter,
  validateBusinessPartnerCreate,
  BusinessPartnerController.createBusinessPartner
);

router.put(
  "/:partnerId",
  validateBusinessPartnerId,
  ...partnerUploads,
  csrfAfterMulter,
  validateBusinessPartnerUpdate,
  BusinessPartnerController.updateBusinessPartner
);

router.delete("/:partnerId", validateBusinessPartnerId, BusinessPartnerController.deleteBusinessPartner);

export default router;
