import * as postService from "../../../services/post.service.js";
import couponService from "../../../services/coupon.service.js";
import * as newsletterService from "../../../services/news-letter.service.js";
import * as testimonialService from "../../../services/testimonial.service.js";
import * as businessPartnerService from "../../../services/business-partner.service.js";
import * as contactService from "../../../services/contact.service.js";
import * as campaignService from "../../../services/campaign.service.js";
import auditLogService from "../../../services/audit-log.service.js";
import { logError, logInfo } from "../../../utils/logger.util.js";
import { resolvePage, resolveLimit, pickPaginationMeta } from "../../../utils/pagination.util.js";
import { buildAuditActor } from "../../../utils/audit-actor.util.js";

// Mirrors controllers/web/admin/{blog/post,marketing/coupon,marketing/news-letter,
// marketing/testimonial,marketing/business-partner,marketing/contact}.controller.js -
// same services, same audit log actions/entity types, same field-flattening the
// validators already expect (productDiscount* for coupons, latitude/longitude for
// business partners - see their validators). Returns raw service data rather than
// routing through the HTML presenters, same reasoning as admin-ops.controller.js.
// Image upload (coverImage/gallery) is out of scope here, same as everywhere else
// in this API - a post/business partner created or edited through this API simply
// keeps whatever image it already had (or none, on create).

function toIdArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

// ================== Blog posts ==================

// BUG FIX: this used to unconditionally overwrite coverImage/gallery with
// whatever `existing` already had (or null/[] on create), discarding
// req.body.coverImage/req.body.gallery entirely - since createPost's
// validateBasicData requires coverImage.img, that made it *impossible* to ever
// create a post through this API (every call failed the "coverImage" check),
// and equally impossible to change a post's cover image on update. Now mirrors
// how admin-catalog.controller.js/admin-people.controller.js already handle
// image/gallery: a client uploads via POST /admin/uploads/posts(/gallery) first
// (see admin-uploads.routes.js - "posts" is already a supported upload type),
// then passes the returned { img, imgDesc, ... } / array straight back on the
// create/update JSON body; req.body wins when provided, existing is only the
// fallback on update when the caller didn't touch that field.
function buildPostPayload(req, existing = {}) {
  const data = { ...req.body };
  data.coverImage = req.body.coverImage ?? existing.coverImage ?? null;
  data.gallery = Array.isArray(req.body.gallery) ? req.body.gallery : existing.gallery || [];
  data.content = Array.isArray(req.body.content) ? req.body.content : existing.content || [];
  data.categories = toIdArray(req.body.categories);
  data.tags = toIdArray(req.body.tags);
  data.author = req.body.author || existing.author || req.user.id;
  return data;
}

export async function listPosts(req, res, next) {
  try {
    const { search, status, sortBy, page = 1, limit = 10 } = req.query;
    const result = await postService.listPosts({
      search: search || "",
      filters: { status: status || undefined },
      sortBy: sortBy || undefined,
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listPosts] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getPost(req, res, next) {
  try {
    const post = await postService.getPostForEdit(req.params.postId);
    return res.json({ success: true, data: post });
  } catch (error) {
    logError("[api/admin/getPost] Greška", error, { postId: req.params.postId });
    next(error);
  }
}

export async function createPost(req, res, next) {
  try {
    const data = buildPostPayload(req);
    const post = await postService.createPost(data);
    logInfo(`[api/admin/createPost] Post kreiran: "${post.naslov}"`, { postId: post.id, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "POST_CREATED", entity: { type: "Post", id: post.id } });
    return res.status(201).json({ success: true, data: post });
  } catch (error) {
    logError("[api/admin/createPost] Greška", error, { body: req.body });
    next(error);
  }
}

export async function updatePost(req, res, next) {
  try {
    const { postId } = req.params;
    const existing = await postService.getPostForEdit(postId);
    const data = buildPostPayload(req, existing);
    const updated = await postService.updatePostById(postId, data);
    logInfo(`[api/admin/updatePost] Post #${postId} ažuriran`, { postId, adminId: req.user.id });
    const afterUpdate = await postService.getPostForEdit(postId);
    const changes = auditLogService.computeChanges(existing, afterUpdate, ["title", "excerpt", "status", "author"]);
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "POST_UPDATED", entity: { type: "Post", id: postId }, changes });
    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/updatePost] Greška", error, { postId: req.params.postId, body: req.body });
    next(error);
  }
}

export async function updatePostStatus(req, res, next) {
  try {
    const { postId } = req.params;
    const existing = await postService.getPostForEdit(postId).catch(() => null);
    const scheduledFor = req.body.scheduledFor ? new Date(req.body.scheduledFor) : null;
    const updated = await postService.updatePostStatus(postId, req.body.status, { scheduledFor });
    logInfo(`[api/admin/updatePostStatus] Status posta #${postId} promenjen na "${req.body.status}"`, { postId, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "POST_STATUS_CHANGED",
      entity: { type: "Post", id: postId },
      changes: { status: { old: existing?.status ?? null, new: req.body.status } },
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/updatePostStatus] Greška", error, { postId: req.params.postId, body: req.body });
    next(error);
  }
}

export async function updatePostSeo(req, res, next) {
  try {
    const { postId } = req.params;
    const seo = {
      title: req.body.seoTitle || "",
      description: req.body.seoDescription || "",
      keywords: Array.isArray(req.body.seoKeywords)
        ? req.body.seoKeywords.filter(Boolean)
        : (req.body.seoKeywords || "").split(",").map((k) => k.trim()).filter(Boolean),
    };
    const updated = await postService.updatePostSeo(postId, seo);
    logInfo(`[api/admin/updatePostSeo] SEO posta #${postId} ažuriran`, { postId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "POST_SEO_UPDATED", entity: { type: "Post", id: postId } });
    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/updatePostSeo] Greška", error, { postId: req.params.postId, body: req.body });
    next(error);
  }
}

export async function deletePost(req, res, next) {
  try {
    const { postId } = req.params;
    await postService.deletePostById(postId);
    logInfo(`[api/admin/deletePost] Post #${postId} obrisan`, { postId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "POST_DELETED", entity: { type: "Post", id: postId } });
    return res.json({ success: true, data: { message: "Post je uspešno obrisan." } });
  } catch (error) {
    logError("[api/admin/deletePost] Greška", error, { postId: req.params.postId });
    next(error);
  }
}

// ================== Coupons ==================

// Same flat-field-to-nested-productDiscount transform as
// coupon.controller.js's buildCouponPayload (see coupon.validator.js - the
// productDiscount* fields are validated flat, exactly like the web form).
function buildCouponPayload(req) {
  const data = { ...req.body };
  data.applicableServices = toIdArray(req.body.applicableServices);
  data.applicablePackages = toIdArray(req.body.applicablePackages);
  data.partner = req.body.partner || null;
  data.discountValue = req.body.discountValue != null ? Number(req.body.discountValue) : undefined;
  data.maxDiscountAmount = req.body.maxDiscountAmount ? Number(req.body.maxDiscountAmount) : null;
  data.minValue = req.body.minValue ? Number(req.body.minValue) : 0;
  data.maxUses = req.body.maxUses && Number(req.body.maxUses) > 0 ? Number(req.body.maxUses) : null;
  data.maxUsesPerUser = req.body.maxUsesPerUser && Number(req.body.maxUsesPerUser) > 0 ? Number(req.body.maxUsesPerUser) : null;
  data.validUntil = req.body.validUntil || null;
  data.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : true;

  const productDiscountEnabled = Boolean(req.body.productDiscountEnabled);
  data.productDiscount = productDiscountEnabled
    ? {
        discountType: req.body.productDiscountType,
        discountValue: req.body.productDiscountValue != null ? Number(req.body.productDiscountValue) : 0,
        maxDiscountAmount: req.body.productDiscountMaxAmount ? Number(req.body.productDiscountMaxAmount) : null,
        minOrderValue: req.body.productMinOrderValue ? Number(req.body.productMinOrderValue) : 0,
        applicableProducts: toIdArray(req.body.applicableProducts),
        excludedCategories: toIdArray(req.body.excludedCategories),
      }
    : null;
  delete data.productDiscountEnabled;
  delete data.productDiscountType;
  delete data.productDiscountValue;
  delete data.productDiscountMaxAmount;
  delete data.productMinOrderValue;
  delete data.applicableProducts;
  delete data.excludedCategories;

  return data;
}

export async function listCoupons(req, res, next) {
  try {
    const { search, isActive, page = 1, limit = 10 } = req.query;
    const result = await couponService.listCoupons({
      search: search || "",
      filters: { isActive: isActive === "true" ? true : isActive === "false" ? false : undefined },
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listCoupons] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getCoupon(req, res, next) {
  try {
    const coupon = await couponService.getCouponForEdit(req.params.couponId);
    return res.json({ success: true, data: coupon });
  } catch (error) {
    logError("[api/admin/getCoupon] Greška", error, { couponId: req.params.couponId });
    next(error);
  }
}

export async function createCoupon(req, res, next) {
  try {
    const data = buildCouponPayload(req);
    const coupon = await couponService.createCoupon(data);
    logInfo(`[api/admin/createCoupon] Kupon "${coupon.osnovno.kod}" kreiran`, { couponId: coupon.id, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "COUPON_CREATED", entity: { type: "Coupon", id: coupon.id } });
    return res.status(201).json({ success: true, data: coupon });
  } catch (error) {
    logError("[api/admin/createCoupon] Greška", error, { body: req.body });
    next(error);
  }
}

export async function updateCoupon(req, res, next) {
  try {
    const { couponId } = req.params;
    const existing = await couponService.getCouponForEdit(couponId);
    const data = buildCouponPayload(req);
    const updated = await couponService.updateCouponById(couponId, data);
    logInfo(`[api/admin/updateCoupon] Kupon #${couponId} ažuriran`, { couponId, adminId: req.user.id });
    const afterUpdate = await couponService.getCouponForEdit(couponId);
    const changes = auditLogService.computeChanges(existing, afterUpdate, [
      "code", "discountType", "discountValue", "maxDiscountAmount", "minValue",
      "maxUses", "maxUsesPerUser", "validUntil", "isActive",
      "productDiscountEnabled", "productDiscountType", "productDiscountValue", "productDiscountMaxAmount", "productMinOrderValue",
    ]);
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "COUPON_UPDATED", entity: { type: "Coupon", id: couponId }, changes });
    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/updateCoupon] Greška", error, { couponId: req.params.couponId, body: req.body });
    next(error);
  }
}

export async function deleteCoupon(req, res, next) {
  try {
    const { couponId } = req.params;
    await couponService.deleteCouponById(couponId);
    logInfo(`[api/admin/deleteCoupon] Kupon #${couponId} obrisan`, { couponId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "COUPON_DELETED", entity: { type: "Coupon", id: couponId } });
    return res.json({ success: true, data: { message: "Kupon je uspešno obrisan." } });
  } catch (error) {
    logError("[api/admin/deleteCoupon] Greška", error, { couponId: req.params.couponId });
    next(error);
  }
}

// ================== Newsletter subscribers ==================

export async function listSubscribers(req, res, next) {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;
    const result = await newsletterService.listSubscribers({
      search: search || "",
      filters: { status: status || undefined },
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listSubscribers] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getSubscriber(req, res, next) {
  try {
    const subscriber = await newsletterService.getSubscriberById(req.params.subscriberId);
    return res.json({ success: true, data: subscriber });
  } catch (error) {
    logError("[api/admin/getSubscriber] Greška", error, { subscriberId: req.params.subscriberId });
    next(error);
  }
}

export async function deleteSubscriber(req, res, next) {
  try {
    const { subscriberId } = req.params;
    await newsletterService.deleteSubscriberById(subscriberId);
    logInfo(`[api/admin/deleteSubscriber] Pretplatnik #${subscriberId} obrisan`, { subscriberId, adminId: req.user.id });
    return res.json({ success: true, data: { message: "Pretplatnik je uspešno obrisan." } });
  } catch (error) {
    logError("[api/admin/deleteSubscriber] Greška", error, { subscriberId: req.params.subscriberId });
    next(error);
  }
}

// ================== Testimonials ==================

export async function listTestimonials(req, res, next) {
  try {
    const { status, isFeatured, page = 1, limit = 10 } = req.query;
    const result = await testimonialService.listTestimonials({
      filters: { status: status || undefined, isFeatured: isFeatured === "true" ? true : isFeatured === "false" ? false : undefined },
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listTestimonials] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getTestimonial(req, res, next) {
  try {
    const testimonial = await testimonialService.getTestimonialById(req.params.testimonialId);
    return res.json({ success: true, data: testimonial });
  } catch (error) {
    logError("[api/admin/getTestimonial] Greška", error, { testimonialId: req.params.testimonialId });
    next(error);
  }
}

export async function approveTestimonial(req, res, next) {
  try {
    const { testimonialId } = req.params;
    const isFeatured = Boolean(req.body.isFeatured);
    await testimonialService.approveTestimonial(testimonialId, { isFeatured });
    logInfo(`[api/admin/approveTestimonial] Testimonijal #${testimonialId} odobren`, { testimonialId, isFeatured, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "TESTIMONIAL_APPROVED",
      entity: { type: "Testimonial", id: testimonialId },
      changes: { status: { old: "pending", new: "approved" }, isFeatured: { old: null, new: isFeatured } },
    });
    const updated = await testimonialService.getTestimonialById(testimonialId);
    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/approveTestimonial] Greška", error, { testimonialId: req.params.testimonialId });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req, { success: false, errorMessage: error.message }),
      action: "TESTIMONIAL_APPROVED",
      entity: { type: "Testimonial", id: req.params.testimonialId },
    });
    next(error);
  }
}

export async function rejectTestimonial(req, res, next) {
  try {
    const { testimonialId } = req.params;
    await testimonialService.rejectTestimonial(testimonialId);
    logInfo(`[api/admin/rejectTestimonial] Testimonijal #${testimonialId} odbijen`, { testimonialId, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "TESTIMONIAL_REJECTED",
      entity: { type: "Testimonial", id: testimonialId },
      changes: { status: { old: "pending", new: "rejected" } },
    });
    const updated = await testimonialService.getTestimonialById(testimonialId);
    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/rejectTestimonial] Greška", error, { testimonialId: req.params.testimonialId });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req, { success: false, errorMessage: error.message }),
      action: "TESTIMONIAL_REJECTED",
      entity: { type: "Testimonial", id: req.params.testimonialId },
    });
    next(error);
  }
}

export async function deleteTestimonial(req, res, next) {
  try {
    const { testimonialId } = req.params;
    await testimonialService.deleteTestimonialById(testimonialId);
    logInfo(`[api/admin/deleteTestimonial] Testimonijal #${testimonialId} obrisan`, { testimonialId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "TESTIMONIAL_DELETED", entity: { type: "Testimonial", id: testimonialId } });
    return res.json({ success: true, data: { message: "Testimonijal je uspešno obrisan." } });
  } catch (error) {
    logError("[api/admin/deleteTestimonial] Greška", error, { testimonialId: req.params.testimonialId });
    next(error);
  }
}

// ================== Business partners ==================

function buildBusinessPartnerPayload(req, existing = {}) {
  const data = { ...req.body };
  data.coverImage = existing.coverImage || null;
  data.content = Array.isArray(req.body.content) ? req.body.content : existing.content || [];
  data.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : existing.isActive ?? true;
  data.geo = {
    latitude: req.body.latitude !== undefined && req.body.latitude !== null && req.body.latitude !== "" ? Number(req.body.latitude) : null,
    longitude: req.body.longitude !== undefined && req.body.longitude !== null && req.body.longitude !== "" ? Number(req.body.longitude) : null,
  };
  delete data.latitude;
  delete data.longitude;
  return data;
}

export async function listBusinessPartners(req, res, next) {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const result = await businessPartnerService.listBusinessPartners({
      search: search || "",
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listBusinessPartners] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getBusinessPartner(req, res, next) {
  try {
    const partner = await businessPartnerService.getBusinessPartnerForEdit(req.params.partnerId);
    return res.json({ success: true, data: partner });
  } catch (error) {
    logError("[api/admin/getBusinessPartner] Greška", error, { partnerId: req.params.partnerId });
    next(error);
  }
}

export async function createBusinessPartner(req, res, next) {
  try {
    const data = buildBusinessPartnerPayload(req);
    const partner = await businessPartnerService.createBusinessPartner(data);
    logInfo(`[api/admin/createBusinessPartner] Saradnik kreiran: "${partner.naziv}"`, { partnerId: partner.id, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "BUSINESS_PARTNER_CREATED", entity: { type: "BusinessPartner", id: partner.id } });
    return res.status(201).json({ success: true, data: partner });
  } catch (error) {
    logError("[api/admin/createBusinessPartner] Greška", error, { body: req.body });
    next(error);
  }
}

export async function updateBusinessPartner(req, res, next) {
  try {
    const { partnerId } = req.params;
    const existing = await businessPartnerService.getBusinessPartnerForEdit(partnerId);
    const data = buildBusinessPartnerPayload(req, existing);
    const updated = await businessPartnerService.updateBusinessPartnerById(partnerId, data);
    logInfo(`[api/admin/updateBusinessPartner] Saradnik #${partnerId} ažuriran`, { partnerId, adminId: req.user.id });
    const afterUpdate = await businessPartnerService.getBusinessPartnerForEdit(partnerId);
    const changes = auditLogService.computeChanges(existing, afterUpdate, ["name", "shortDescription", "outboundUrl", "isActive"]);
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "BUSINESS_PARTNER_UPDATED", entity: { type: "BusinessPartner", id: partnerId }, changes });
    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/updateBusinessPartner] Greška", error, { partnerId: req.params.partnerId, body: req.body });
    next(error);
  }
}

export async function deleteBusinessPartner(req, res, next) {
  try {
    const { partnerId } = req.params;
    await businessPartnerService.deleteBusinessPartnerById(partnerId);
    logInfo(`[api/admin/deleteBusinessPartner] Saradnik #${partnerId} obrisan`, { partnerId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "BUSINESS_PARTNER_DELETED", entity: { type: "BusinessPartner", id: partnerId } });
    return res.json({ success: true, data: { message: "Saradnik je uspešno obrisan." } });
  } catch (error) {
    logError("[api/admin/deleteBusinessPartner] Greška", error, { partnerId: req.params.partnerId });
    next(error);
  }
}

// ================== Contact messages ==================

export async function listContacts(req, res, next) {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;
    const result = await contactService.listContacts({
      search: search || "",
      filters: { status: status || undefined },
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listContacts] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getContact(req, res, next) {
  try {
    const { contactId } = req.params;
    const contact = await contactService.getContactById(contactId);
    // Same as contact.controller.js's web version - opening a message the admin
    // hasn't seen yet marks it read, so the list badge clears.
    if (contact.osnovno.statusRaw === "new") {
      await contactService.updateContactStatus(contactId, "read");
      contact.osnovno.statusRaw = "read";
    }
    return res.json({ success: true, data: contact });
  } catch (error) {
    logError("[api/admin/getContact] Greška", error, { contactId: req.params.contactId });
    next(error);
  }
}

export async function updateContactStatus(req, res, next) {
  try {
    const { contactId } = req.params;
    const updated = await contactService.updateContactStatus(contactId, req.body.status);
    logInfo(`[api/admin/updateContactStatus] Status poruke #${contactId} promenjen na "${req.body.status}"`, { contactId, adminId: req.user.id });
    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/updateContactStatus] Greška", error, { contactId: req.params.contactId, body: req.body });
    next(error);
  }
}

// ================== Newsletter campaigns ==================

function buildCampaignPayload(req) {
  return {
    title: req.body.title,
    subject: req.body.subject,
    content: Array.isArray(req.body.content) ? req.body.content : [],
    targetInterests: toIdArray(req.body.targetInterests),
    status: req.body.status || "draft",
    scheduledFor: req.body.scheduledFor ? new Date(req.body.scheduledFor) : null,
  };
}

export async function listCampaigns(req, res, next) {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;
    const result = await campaignService.listCampaigns({
      search: search || "",
      filters: { status: status || undefined },
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listCampaigns] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getCampaign(req, res, next) {
  try {
    const campaign = await campaignService.getCampaignForEdit(req.params.campaignId);
    return res.json({ success: true, data: campaign });
  } catch (error) {
    logError("[api/admin/getCampaign] Greška", error, { campaignId: req.params.campaignId });
    next(error);
  }
}

export async function createCampaign(req, res, next) {
  try {
    const data = buildCampaignPayload(req);
    const campaign = await campaignService.createCampaign(data);
    logInfo(`[api/admin/createCampaign] Kampanja kreirana: "${campaign.naslov}"`, { campaignId: campaign.id, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "CAMPAIGN_CREATED", entity: { type: "Campaign", id: campaign.id } });
    return res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    logError("[api/admin/createCampaign] Greška", error, { body: req.body });
    next(error);
  }
}

export async function updateCampaign(req, res, next) {
  try {
    const { campaignId } = req.params;
    const existing = await campaignService.getCampaignForEdit(campaignId);
    const data = buildCampaignPayload(req);
    const updated = await campaignService.updateCampaignById(campaignId, data);
    logInfo(`[api/admin/updateCampaign] Kampanja #${campaignId} ažurirana`, { campaignId, adminId: req.user.id });
    const afterUpdate = await campaignService.getCampaignForEdit(campaignId);
    const changes = auditLogService.computeChanges(existing, afterUpdate, ["title", "subject", "status"]);
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "CAMPAIGN_UPDATED", entity: { type: "Campaign", id: campaignId }, changes });
    return res.json({ success: true, data: updated });
  } catch (error) {
    logError("[api/admin/updateCampaign] Greška", error, { campaignId: req.params.campaignId, body: req.body });
    next(error);
  }
}

export async function sendCampaignNow(req, res, next) {
  try {
    const { campaignId } = req.params;
    const sent = await campaignService.sendCampaignNow(campaignId);
    logInfo(`[api/admin/sendCampaignNow] Kampanja #${campaignId} poslata`, { campaignId, sentCount: sent.poslato, failedCount: sent.neuspesno, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "CAMPAIGN_SENT",
      entity: { type: "Campaign", id: campaignId },
      changes: { sentCount: { old: null, new: sent.poslato }, failedCount: { old: null, new: sent.neuspesno } },
    });
    return res.json({ success: true, data: sent });
  } catch (error) {
    logError("[api/admin/sendCampaignNow] Greška", error, { campaignId: req.params.campaignId });
    next(error);
  }
}

export async function deleteCampaign(req, res, next) {
  try {
    const { campaignId } = req.params;
    await campaignService.deleteCampaignById(campaignId);
    logInfo(`[api/admin/deleteCampaign] Kampanja #${campaignId} obrisana`, { campaignId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "CAMPAIGN_DELETED", entity: { type: "Campaign", id: campaignId } });
    return res.json({ success: true, data: { message: "Kampanja je uspešno obrisana." } });
  } catch (error) {
    logError("[api/admin/deleteCampaign] Greška", error, { campaignId: req.params.campaignId });
    next(error);
  }
}

export default {
  listPosts, getPost, createPost, updatePost, updatePostStatus, updatePostSeo, deletePost,
  listCoupons, getCoupon, createCoupon, updateCoupon, deleteCoupon,
  listSubscribers, getSubscriber, deleteSubscriber,
  listTestimonials, getTestimonial, approveTestimonial, rejectTestimonial, deleteTestimonial,
  listBusinessPartners, getBusinessPartner, createBusinessPartner, updateBusinessPartner, deleteBusinessPartner,
  listContacts, getContact, updateContactStatus,
  listCampaigns, getCampaign, createCampaign, updateCampaign, sendCampaignNow, deleteCampaign,
};
