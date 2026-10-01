import { Router } from "express";
import * as PackageController from "../../controllers/web/catalog/package.controller.js";

const router = Router();

router.get("/", PackageController.packageList);
router.get("/kategorija/:categorySlug", PackageController.packageCategory);
router.get("/:slug", PackageController.packageDetails);

export default router;
