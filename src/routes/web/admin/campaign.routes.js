import { Router } from "express";
import * as CampaignController from "../../../controllers/web/admin/marketing/campaign.controller.js";
import { validateCampaignCreate, validateCampaignUpdate, validateCampaignId } from "../../../middlewares/validators/campaign.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";

const router = Router();

router.get("/", validateSearch, CampaignController.listCampaigns);
router.get("/dodavanje", CampaignController.newCampaignForm);
router.get("/detalji/:campaignId", validateCampaignId, CampaignController.campaignDetails);
router.get("/izmena/:campaignId", validateCampaignId, CampaignController.editCampaignForm);

router.post("/", validateCampaignCreate, CampaignController.createCampaign);
router.put("/:campaignId", validateCampaignId, validateCampaignUpdate, CampaignController.updateCampaign);
router.post("/:campaignId/posalji", validateCampaignId, CampaignController.sendCampaignNow);
router.delete("/:campaignId", validateCampaignId, CampaignController.deleteCampaign);

export default router;
