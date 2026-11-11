import { Router } from "express";
import * as WheelController from "../../../controllers/web/admin/marketing/wheel.controller.js";
import { validateLeadId, validatePrizeId, validatePrizeUpdate, validatePrizeCreate, validatePrizeFullUpdate } from "../../../middlewares/validators/wheel.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";

const router = Router();

// fixed paths first so none of them can be read as a :leadId
router.get("/kuponi", validateSearch, WheelController.listWheelCoupons);
router.get("/nagrade", WheelController.prizesPage);
router.get("/nagrade/nova", WheelController.newPrizeForm);
router.post("/nagrade", validatePrizeCreate, WheelController.createPrize);
router.get("/nagrade/:prizeId/izmena", validatePrizeId, WheelController.editPrizeForm);
router.put("/nagrade/:prizeId/izmena", validatePrizeId, validatePrizeFullUpdate, WheelController.updatePrizeFull);
router.delete("/nagrade/:prizeId", validatePrizeId, WheelController.deletePrize);
router.put("/nagrade/:prizeId", validatePrizeId, validatePrizeUpdate, WheelController.updatePrize);
router.get("/izvoz.csv", WheelController.exportLeads);
router.get("/qr.svg", (req, res, next) => { req.params.format = "svg"; next(); }, WheelController.qrDownload);
router.get("/qr.png", (req, res, next) => { req.params.format = "png"; next(); }, WheelController.qrDownload);

router.get("/", validateSearch, WheelController.listLeads);
router.get("/detalji/:leadId", validateLeadId, WheelController.leadDetails);
router.delete("/:leadId", validateLeadId, WheelController.deleteLead);

export default router;
