import { Router } from "express";
import * as BlogController from "../../controllers/web/blog/blog.controller.js";
import { searchLimiter } from "../../middlewares/rate-limiter.middleware.js";

const router = Router();

router.get("/", BlogController.blogHome);
router.get("/pretraga", searchLimiter, BlogController.searchBlog);
router.get("/kategorija/:categorySlug", BlogController.blogCategory);
router.get("/tag/:tagSlug", BlogController.blogTag);
router.get("/:slug", BlogController.postDetails);

export default router;
