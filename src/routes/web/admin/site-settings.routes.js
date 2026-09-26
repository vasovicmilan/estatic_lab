import { Router } from "express";
import * as SiteSettingsController from "../../../controllers/web/admin/marketing/site-settings.controller.js";
import { csrfAfterMulter } from "../../../config/csrf.config.js";
import { processUpload } from "../../../config/multer.config.js";
import { parseJsonFields } from "../../../middlewares/parse-json-fields.middleware.js";
import { validateWorkingHoursUpdate, validateClosedDatesUpdate } from "../../../middlewares/validators/site-settings.validator.js";

const router = Router();

router.get("/", SiteSettingsController.siteSettingsForm);

router.put("/", ...processUpload("heroImage", "site"), csrfAfterMulter, SiteSettingsController.updateSiteSettings);

// Separate small forms (not multipart, no file upload involved) - kept apart
// from the main "/" save above the same way employee.routes.js's own
// "/:employeeId/radno-vreme" endpoint is separate from the general employee
// update: a working-hours/closed-dates table is naturally its own form
// section, and this avoids re-submitting the hero image field/policy numbers
// just to change one closed date.
router.put("/radno-vreme", parseJsonFields("workingHours"), validateWorkingHoursUpdate, SiteSettingsController.updateWorkingHours);
router.put("/neradni-dani", parseJsonFields("closedDates"), validateClosedDatesUpdate, SiteSettingsController.updateClosedDates);

export default router;
