import { Router } from "express";
import * as CampaignController from "../../../controllers/web/admin/marketing/campaign.controller.js";
import { validateCampaignCreate, validateCampaignUpdate, validateCampaignId, validateCampaignTest } from "../../../middlewares/validators/campaign.validator.js";
import { csrfAfterMulter } from "../../../config/csrf.config.js";
import { processUpload } from "../../../config/multer.config.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";

const router = Router();

router.get("/", validateSearch, CampaignController.listCampaigns);
router.get("/dodavanje", CampaignController.newCampaignForm);
router.get("/detalji/:campaignId", validateCampaignId, CampaignController.campaignDetails);
router.get("/izmena/:campaignId", validateCampaignId, CampaignController.editCampaignForm);

// image for an "image" block: multipart, JSON back (the editor script puts the path into the block)
router.post("/otpremi-sliku", ...processUpload("image", "campaigns"), csrfAfterMulter, CampaignController.uploadCampaignImage);

router.post("/", validateCampaignCreate, CampaignController.createCampaign);
router.put("/:campaignId", validateCampaignId, validateCampaignUpdate, CampaignController.updateCampaign);
router.put("/:campaignId/posalji", validateCampaignId, CampaignController.sendCampaignNow);
router.post("/:campaignId/probni", validateCampaignId, validateCampaignTest, CampaignController.sendCampaignTest);
router.delete("/:campaignId", validateCampaignId, CampaignController.deleteCampaign);

export default router;
