import { Router } from "express";
import * as SiteSettingsController from "../../../controllers/web/admin/marketing/site-settings.controller.js";
import { csrfAfterMulter } from "../../../config/csrf.config.js";
import { processUpload } from "../../../config/multer.config.js";

const router = Router();

router.get("/", SiteSettingsController.siteSettingsForm);

router.put("/", ...processUpload("heroImage", "site"), csrfAfterMulter, SiteSettingsController.updateSiteSettings);

export default router;