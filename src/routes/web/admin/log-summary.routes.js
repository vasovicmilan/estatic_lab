import { Router } from "express";
import * as LogSummaryController from "../../../controllers/web/admin/logs/log-summary.controller.js";

const router = Router();

router.get("/", LogSummaryController.logDashboard);
router.get("/istorija", LogSummaryController.logHistoryList);
router.get("/istorija/:date", LogSummaryController.logSummaryDetail);

export default router;