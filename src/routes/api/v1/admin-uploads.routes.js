import { Router } from "express";
import {
  requireUploadPermission,
  requireUploadModule,
  uploadSingleMiddleware,
  uploadGalleryMiddleware,
  uploadVideoMiddleware,
  uploadFile,
  uploadMultiple,
} from "../../../controllers/api/v1/admin-uploads.controller.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";

const router = Router();
router.use(apiAuthMiddleware);

// :type is one of the keys admin-uploads.controller.js's TYPE_PERMISSIONS knows about
// (services/packages/products/categories/posts/testimonials/experts/partners/
// business-partners/site) - requireUploadPermission rejects anything else with a 400
// before multer ever runs.
//
// Response shape matches exactly what handleImageUpload()/processVideo() in
// multer.config.js already produce for the web admin panel's req.uploadedFile /
// req.uploadedFiles - { img, imgThumb, imgMedium, imgOriginal, imgDesc } for an image,
// { url, thumbnail, title } for a video. Callers pass that object straight back as the
// image/gallery/video field on the normal JSON create/update call for the entity.
router.post("/uploads/:type", requireUploadPermission, requireUploadModule, ...uploadSingleMiddleware, uploadFile);
router.post("/uploads/:type/gallery", requireUploadPermission, requireUploadModule, ...uploadGalleryMiddleware, uploadMultiple);
router.post("/uploads/:type/video", requireUploadPermission, requireUploadModule, ...uploadVideoMiddleware, uploadMultiple);

export default router;
