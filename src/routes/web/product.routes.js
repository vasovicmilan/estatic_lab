import { Router } from "express";
import * as ProductController from "../../controllers/web/catalog/product.controller.js";
import { searchLimiter } from "../../middlewares/rate-limiter.middleware.js";

const router = Router();

router.get("/", ProductController.productList);
router.get("/kategorija/:categorySlug", ProductController.productCategory);
router.get("/tag/:tagSlug", ProductController.productTag);
router.get("/:slug", searchLimiter, ProductController.productDetails);

export default router;