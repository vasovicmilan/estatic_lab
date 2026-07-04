import { Router } from "express";
import * as ExpertController from "../../controllers/web/public/expert.controller.js";

const router = Router();

router.get("/", ExpertController.expertList);
router.get("/:slug", ExpertController.expertDetails);

export default router;
