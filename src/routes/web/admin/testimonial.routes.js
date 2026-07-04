import { Router } from "express";
import * as TestimonialController from "../../../controllers/web/admin/marketing/testimonial.controller.js";
import { validateTestimonialApprove, validateTestimonialId } from "../../../middlewares/validators/testimonial.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";

const router = Router();

router.get("/", validateSearch, TestimonialController.listTestimonials);
router.get("/detalji/:testimonialId", validateTestimonialId, TestimonialController.testimonialDetails);

router.put("/:testimonialId/odobri", validateTestimonialId, validateTestimonialApprove, TestimonialController.approveTestimonial);
router.put("/:testimonialId/odbij", validateTestimonialId, TestimonialController.rejectTestimonial);

router.delete("/:testimonialId", validateTestimonialId, TestimonialController.deleteTestimonial);

export default router;
