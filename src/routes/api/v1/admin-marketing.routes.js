import { Router } from "express";
import * as AdminMarketingController from "../../../controllers/api/v1/admin-marketing.controller.js";
import { validatePostCreate, validatePostUpdate, validatePostStatus, validatePostSeo, validatePostId } from "../../../middlewares/validators/post.validator.js";
import { validateCouponCreate, validateCouponUpdate, validateCouponId } from "../../../middlewares/validators/coupon.validator.js";
import { validateSubscriberId } from "../../../middlewares/validators/newsletter.validator.js";
import { validateTestimonialApprove, validateTestimonialId } from "../../../middlewares/validators/testimonial.validator.js";
import { validateBusinessPartnerCreate, validateBusinessPartnerUpdate, validateBusinessPartnerId } from "../../../middlewares/validators/business-partner.validator.js";
import { validateContactStatus, validateContactId } from "../../../middlewares/validators/contact.validator.js";
import { validateCampaignCreate, validateCampaignUpdate, validateCampaignId } from "../../../middlewares/validators/campaign.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";
import { requirePermission } from "../../../middlewares/permission.middleware.js";

const router = Router();
router.use(apiAuthMiddleware);

// ---- Blog posts ----
router.get("/posts", requirePermission("manage_blog"), AdminMarketingController.listPosts);
router.get("/posts/:postId", requirePermission("manage_blog"), validatePostId, handleApiValidationErrors, AdminMarketingController.getPost);
router.post("/posts", requirePermission("manage_blog"), validatePostCreate, handleApiValidationErrors, AdminMarketingController.createPost);
router.put("/posts/:postId", requirePermission("manage_blog"), validatePostId, validatePostUpdate, handleApiValidationErrors, AdminMarketingController.updatePost);
router.put("/posts/:postId/status", requirePermission("manage_blog"), validatePostId, validatePostStatus, handleApiValidationErrors, AdminMarketingController.updatePostStatus);
router.put("/posts/:postId/seo", requirePermission("manage_blog"), validatePostId, validatePostSeo, handleApiValidationErrors, AdminMarketingController.updatePostSeo);
router.delete("/posts/:postId", requirePermission("manage_blog"), validatePostId, handleApiValidationErrors, AdminMarketingController.deletePost);

// ---- Coupons ----
router.get("/coupons", requirePermission("manage_coupons"), AdminMarketingController.listCoupons);
router.get("/coupons/:couponId", requirePermission("manage_coupons"), validateCouponId, handleApiValidationErrors, AdminMarketingController.getCoupon);
router.post("/coupons", requirePermission("manage_coupons"), validateCouponCreate, handleApiValidationErrors, AdminMarketingController.createCoupon);
router.put("/coupons/:couponId", requirePermission("manage_coupons"), validateCouponId, validateCouponUpdate, handleApiValidationErrors, AdminMarketingController.updateCoupon);
router.delete("/coupons/:couponId", requirePermission("manage_coupons"), validateCouponId, handleApiValidationErrors, AdminMarketingController.deleteCoupon);

// ---- Newsletter subscribers ----
router.get("/newsletter-subscribers", requirePermission("manage_marketing"), AdminMarketingController.listSubscribers);
router.get("/newsletter-subscribers/:subscriberId", requirePermission("manage_marketing"), validateSubscriberId, handleApiValidationErrors, AdminMarketingController.getSubscriber);
router.delete("/newsletter-subscribers/:subscriberId", requirePermission("manage_marketing"), validateSubscriberId, handleApiValidationErrors, AdminMarketingController.deleteSubscriber);

// ---- Testimonials ----
router.get("/testimonials", requirePermission("manage_marketing"), AdminMarketingController.listTestimonials);
router.get("/testimonials/:testimonialId", requirePermission("manage_marketing"), validateTestimonialId, handleApiValidationErrors, AdminMarketingController.getTestimonial);
router.put("/testimonials/:testimonialId/approve", requirePermission("manage_marketing"), validateTestimonialId, validateTestimonialApprove, handleApiValidationErrors, AdminMarketingController.approveTestimonial);
router.put("/testimonials/:testimonialId/reject", requirePermission("manage_marketing"), validateTestimonialId, handleApiValidationErrors, AdminMarketingController.rejectTestimonial);
router.delete("/testimonials/:testimonialId", requirePermission("manage_marketing"), validateTestimonialId, handleApiValidationErrors, AdminMarketingController.deleteTestimonial);

// ---- Business partners ----
router.get("/business-partners", requirePermission("manage_marketing"), AdminMarketingController.listBusinessPartners);
router.get("/business-partners/:partnerId", requirePermission("manage_marketing"), validateBusinessPartnerId, handleApiValidationErrors, AdminMarketingController.getBusinessPartner);
router.post("/business-partners", requirePermission("manage_marketing"), validateBusinessPartnerCreate, handleApiValidationErrors, AdminMarketingController.createBusinessPartner);
router.put("/business-partners/:partnerId", requirePermission("manage_marketing"), validateBusinessPartnerId, validateBusinessPartnerUpdate, handleApiValidationErrors, AdminMarketingController.updateBusinessPartner);
router.delete("/business-partners/:partnerId", requirePermission("manage_marketing"), validateBusinessPartnerId, handleApiValidationErrors, AdminMarketingController.deleteBusinessPartner);

// ---- Contact messages ----
router.get("/contacts", requirePermission("manage_marketing"), AdminMarketingController.listContacts);
router.get("/contacts/:contactId", requirePermission("manage_marketing"), validateContactId, handleApiValidationErrors, AdminMarketingController.getContact);
router.put("/contacts/:contactId/status", requirePermission("manage_marketing"), validateContactId, validateContactStatus, handleApiValidationErrors, AdminMarketingController.updateContactStatus);

// ---- Newsletter campaigns ----
router.get("/newsletter-campaigns", requirePermission("manage_marketing"), AdminMarketingController.listCampaigns);
router.get("/newsletter-campaigns/:campaignId", requirePermission("manage_marketing"), validateCampaignId, handleApiValidationErrors, AdminMarketingController.getCampaign);
router.post("/newsletter-campaigns", requirePermission("manage_marketing"), validateCampaignCreate, handleApiValidationErrors, AdminMarketingController.createCampaign);
router.put("/newsletter-campaigns/:campaignId", requirePermission("manage_marketing"), validateCampaignId, validateCampaignUpdate, handleApiValidationErrors, AdminMarketingController.updateCampaign);
router.put("/newsletter-campaigns/:campaignId/send", requirePermission("manage_marketing"), validateCampaignId, handleApiValidationErrors, AdminMarketingController.sendCampaignNow);
router.delete("/newsletter-campaigns/:campaignId", requirePermission("manage_marketing"), validateCampaignId, handleApiValidationErrors, AdminMarketingController.deleteCampaign);

export default router;