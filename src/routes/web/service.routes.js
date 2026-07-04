import { Router } from "express";
import * as ServiceController from "../../controllers/web/catalog/service.controller.js";
import { searchLimiter } from "../../middlewares/rate-limiter.middleware.js";

const router = Router();

router.get("/", ServiceController.serviceList);
router.get("/kategorija/:categorySlug", ServiceController.serviceCategory);
router.get("/:slug", searchLimiter, ServiceController.serviceDetails);

export default router;
