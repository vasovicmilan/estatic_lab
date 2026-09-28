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
import { PERMISSION } from "../../../models/role.model.js";
import { requireModule } from "../../../middlewares/feature.middleware.js";

const router = Router();
router.use(apiAuthMiddleware);

// ---- Blog posts ----
router.get("/posts", requireModule("blog"), requirePermission(PERMISSION.MANAGE_BLOG), AdminMarketingController.listPosts);
router.get("/posts/:postId", requireModule("blog"), requirePermission(PERMISSION.MANAGE_BLOG), validatePostId, handleApiValidationErrors, AdminMarketingController.getPost);
router.get("/posts/:postId/edit", requireModule("blog"), requirePermission(PERMISSION.MANAGE_BLOG), validatePostId, handleApiValidationErrors, AdminMarketingController.getPostForEdit);
router.post("/posts", requireModule("blog"), requirePermission(PERMISSION.MANAGE_BLOG), validatePostCreate, handleApiValidationErrors, AdminMarketingController.createPost);
router.put("/posts/:postId", requireModule("blog"), requirePermission(PERMISSION.MANAGE_BLOG), validatePostId, validatePostUpdate, handleApiValidationErrors, AdminMarketingController.updatePost);
router.put("/posts/:postId/status", requireModule("blog"), requirePermission(PERMISSION.MANAGE_BLOG), validatePostId, validatePostStatus, handleApiValidationErrors, AdminMarketingController.updatePostStatus);
router.put("/posts/:postId/seo", requireModule("blog"), requirePermission(PERMISSION.MANAGE_BLOG), validatePostId, validatePostSeo, handleApiValidationErrors, AdminMarketingController.updatePostSeo);
router.delete("/posts/:postId", requireModule("blog"), requirePermission(PERMISSION.MANAGE_BLOG), validatePostId, handleApiValidationErrors, AdminMarketingController.deletePost);

// ---- Coupons ----
router.get("/coupons", requireModule("coupons"), requirePermission(PERMISSION.MANAGE_COUPONS), AdminMarketingController.listCoupons);
router.get("/coupons/:couponId", requireModule("coupons"), requirePermission(PERMISSION.MANAGE_COUPONS), validateCouponId, handleApiValidationErrors, AdminMarketingController.getCoupon);
// Raw/edit shape - see admin-marketing.controller.js's getCoupon header comment
// for why this is now a second endpoint (same reasoning as the business-partners
// :id/edit route above).
router.get("/coupons/:couponId/edit", requireModule("coupons"), requirePermission(PERMISSION.MANAGE_COUPONS), validateCouponId, handleApiValidationErrors, AdminMarketingController.getCouponForEdit);
router.post("/coupons", requireModule("coupons"), requirePermission(PERMISSION.MANAGE_COUPONS), validateCouponCreate, handleApiValidationErrors, AdminMarketingController.createCoupon);
router.put("/coupons/:couponId", requireModule("coupons"), requirePermission(PERMISSION.MANAGE_COUPONS), validateCouponId, validateCouponUpdate, handleApiValidationErrors, AdminMarketingController.updateCoupon);
router.delete("/coupons/:couponId", requireModule("coupons"), requirePermission(PERMISSION.MANAGE_COUPONS), validateCouponId, handleApiValidationErrors, AdminMarketingController.deleteCoupon);

// ---- Newsletter subscribers ----
router.get("/newsletter-subscribers", requirePermission(PERMISSION.MANAGE_MARKETING), AdminMarketingController.listSubscribers);
router.get("/newsletter-subscribers/:subscriberId", requirePermission(PERMISSION.MANAGE_MARKETING), validateSubscriberId, handleApiValidationErrors, AdminMarketingController.getSubscriber);
router.delete("/newsletter-subscribers/:subscriberId", requirePermission(PERMISSION.MANAGE_MARKETING), validateSubscriberId, handleApiValidationErrors, AdminMarketingController.deleteSubscriber);

// ---- Testimonials ----
router.get("/testimonials", requirePermission(PERMISSION.MANAGE_MARKETING), AdminMarketingController.listTestimonials);
router.get("/testimonials/:testimonialId", requirePermission(PERMISSION.MANAGE_MARKETING), validateTestimonialId, handleApiValidationErrors, AdminMarketingController.getTestimonial);
router.put("/testimonials/:testimonialId/approve", requirePermission(PERMISSION.MANAGE_MARKETING), validateTestimonialId, validateTestimonialApprove, handleApiValidationErrors, AdminMarketingController.approveTestimonial);
router.put("/testimonials/:testimonialId/reject", requirePermission(PERMISSION.MANAGE_MARKETING), validateTestimonialId, handleApiValidationErrors, AdminMarketingController.rejectTestimonial);
router.delete("/testimonials/:testimonialId", requirePermission(PERMISSION.MANAGE_MARKETING), validateTestimonialId, handleApiValidationErrors, AdminMarketingController.deleteTestimonial);

// ---- Business partners ----
router.get("/business-partners", requirePermission(PERMISSION.MANAGE_MARKETING), AdminMarketingController.listBusinessPartners);
router.get("/business-partners/:partnerId", requirePermission(PERMISSION.MANAGE_MARKETING), validateBusinessPartnerId, handleApiValidationErrors, AdminMarketingController.getBusinessPartner);
// Raw/edit shape - see admin-marketing.controller.js's getBusinessPartner header
// comment for why this is now a second endpoint (same reasoning as the Category/
// Employee/Partner :id/edit routes elsewhere in this codebase).
router.get("/business-partners/:partnerId/edit", requirePermission(PERMISSION.MANAGE_MARKETING), validateBusinessPartnerId, handleApiValidationErrors, AdminMarketingController.getBusinessPartnerForEdit);
router.post("/business-partners", requirePermission(PERMISSION.MANAGE_MARKETING), validateBusinessPartnerCreate, handleApiValidationErrors, AdminMarketingController.createBusinessPartner);
router.put("/business-partners/:partnerId", requirePermission(PERMISSION.MANAGE_MARKETING), validateBusinessPartnerId, validateBusinessPartnerUpdate, handleApiValidationErrors, AdminMarketingController.updateBusinessPartner);
router.delete("/business-partners/:partnerId", requirePermission(PERMISSION.MANAGE_MARKETING), validateBusinessPartnerId, handleApiValidationErrors, AdminMarketingController.deleteBusinessPartner);

// ---- Contact messages ----
router.get("/contacts", requirePermission(PERMISSION.MANAGE_MARKETING), AdminMarketingController.listContacts);
router.get("/contacts/:contactId", requirePermission(PERMISSION.MANAGE_MARKETING), validateContactId, handleApiValidationErrors, AdminMarketingController.getContact);
router.put("/contacts/:contactId/status", requirePermission(PERMISSION.MANAGE_MARKETING), validateContactId, validateContactStatus, handleApiValidationErrors, AdminMarketingController.updateContactStatus);

// ---- Newsletter campaigns ----
router.get("/newsletter-campaigns", requirePermission(PERMISSION.MANAGE_MARKETING), AdminMarketingController.listCampaigns);
router.get("/newsletter-campaigns/:campaignId", requirePermission(PERMISSION.MANAGE_MARKETING), validateCampaignId, handleApiValidationErrors, AdminMarketingController.getCampaign);
// getCampaign already returns the raw edit shape (campaignService.getCampaignForEdit), so /edit is
// the same handler - added so campaigns follow the same GET /:id/edit convention as every other
// admin resource (the Angular admin-campaign-form calls this path).
router.get("/newsletter-campaigns/:campaignId/edit", requirePermission(PERMISSION.MANAGE_MARKETING), validateCampaignId, handleApiValidationErrors, AdminMarketingController.getCampaign);
router.post("/newsletter-campaigns", requirePermission(PERMISSION.MANAGE_MARKETING), validateCampaignCreate, handleApiValidationErrors, AdminMarketingController.createCampaign);
router.put("/newsletter-campaigns/:campaignId", requirePermission(PERMISSION.MANAGE_MARKETING), validateCampaignId, validateCampaignUpdate, handleApiValidationErrors, AdminMarketingController.updateCampaign);
router.put("/newsletter-campaigns/:campaignId/send", requirePermission(PERMISSION.MANAGE_MARKETING), validateCampaignId, handleApiValidationErrors, AdminMarketingController.sendCampaignNow);
router.delete("/newsletter-campaigns/:campaignId", requirePermission(PERMISSION.MANAGE_MARKETING), validateCampaignId, handleApiValidationErrors, AdminMarketingController.deleteCampaign);

export default router;