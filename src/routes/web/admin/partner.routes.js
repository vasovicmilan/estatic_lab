import { Router } from "express";
import * as PartnerController from "../../../controllers/web/admin/auth/partner.controller.js";
import { validatePartnerCreate, validatePartnerUpdate, validatePartnerId } from "../../../middlewares/validators/partner.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";

const router = Router();

router.get("/", validateSearch, PartnerController.listPartners);
router.get("/dodavanje", PartnerController.newPartnerForm);
router.get("/detalji/:partnerId", validatePartnerId, PartnerController.partnerDetails);
router.get("/izmena/:partnerId", validatePartnerId, PartnerController.editPartnerForm);

router.post("/", validatePartnerCreate, PartnerController.createPartner);

router.put("/:partnerId", validatePartnerId, validatePartnerUpdate, PartnerController.updatePartner);

router.delete("/:partnerId", validatePartnerId, PartnerController.deletePartner);

export default router;