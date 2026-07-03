import { Router } from "express";
import * as PostController from "../../../controllers/web/admin/blog/post.controller.js";
import {
  validatePostCreate,
  validatePostUpdate,
  validatePostStatus,
  validatePostSeo,
  validatePostId,
} from "../../../middlewares/validators/post.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";
import { csrfAfterMulter } from "../../../config/csrf.config.js";
import { processMultipleUploads } from "../../../config/multer.config.js";

const router = Router();

const postUploads = processMultipleUploads([
  { name: "coverImage", maxCount: 1, type: "posts" },
  { name: "gallery", maxCount: 10, type: "posts" },
]);

router.get("/", validateSearch, PostController.listPosts);
router.get("/dodavanje", PostController.newPostForm);
router.get("/detalji/:postId", validatePostId, PostController.postDetails);
router.get("/izmena/:postId", validatePostId, PostController.editPostForm);
router.get("/:postId/seo", validatePostId, PostController.editPostSeoForm);

router.post(
  "/",
  ...postUploads,
  csrfAfterMulter,
  validatePostCreate,
  PostController.createPost
);

router.put(
  "/:postId",
  validatePostId,
  ...postUploads,
  csrfAfterMulter,
  validatePostUpdate,
  PostController.updatePost
);

router.put("/:postId/status", validatePostId, validatePostStatus, PostController.updatePostStatus);
router.put("/:postId/seo", validatePostId, validatePostSeo, PostController.updatePostSeo);

router.delete("/:postId", validatePostId, PostController.deletePost);

export default router;