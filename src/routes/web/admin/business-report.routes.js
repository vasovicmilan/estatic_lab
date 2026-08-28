import { Router } from "express";
import * as BusinessReportController from "../../../controllers/web/admin/reports/business-report.controller.js";

const router = Router();

router.get("/", BusinessReportController.businessReportDashboard);
router.get("/istorija/:periodType", BusinessReportController.businessReportHistoryList);
router.get("/istorija/:periodType/:periodKey", BusinessReportController.businessReportDetail);
router.get("/istorija/:periodType/:periodKey/pdf", BusinessReportController.businessReportDownloadPdf);

export default router;
