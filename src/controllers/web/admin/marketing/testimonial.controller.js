import * as testimonialService from "../../../../services/testimonial.service.js";
import { prepareTestimonialListData, prepareTestimonialDetailsData } from "../../../../presenters/admin/marketing/testimonial.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";
import { parseCheckbox } from "../../../../utils/form-bool.util.js";

export async function listTestimonials(req, res, next) {
  try {
    const { status, isFeatured, page = 1, limit = 10 } = req.query;

    const result = await testimonialService.listTestimonials({
      filters: {
        status: status || undefined,
        isFeatured: isFeatured === "true" ? true : isFeatured === "false" ? false : undefined,
      },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareTestimonialListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: "Testimoniali",
      pageDescription: "Pregled svih testimoniala",
      data: viewData,
    });
  } catch (error) {
    logError("[listTestimonials] Greška pri učitavanju liste testimoniala", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function testimonialDetails(req, res, next) {
  try {
    const { testimonialId } = req.params;
    const testimonial = await testimonialService.getTestimonialById(testimonialId);
    const viewData = prepareTestimonialDetailsData(testimonial);

    return res.render("admin/_details", {
      pageTitle: `Testimonijal - ${testimonial.osnovno.ime}`,
      pageDescription: testimonial.osnovno.komentar,
      data: viewData,
    });
  } catch (error) {
    logError("[testimonialDetails] Greška pri učitavanju detalja testimoniala", error, {
      testimonialId: req.params.testimonialId,
      userId: req.session?.user?.id,
    });
    next(error);
  }
}

export async function approveTestimonial(req, res, next) {
  try {
    const { testimonialId } = req.params;
    const isFeatured = parseCheckbox(req.body.isFeatured);

    await testimonialService.approveTestimonial(testimonialId, { isFeatured });
    logInfo(`[approveTestimonial] Testimonijal #${testimonialId} odobren`, { testimonialId, isFeatured, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Testimonijal je uspešno odobren", `/admin/testimoniali/detalji/${testimonialId}`);
  } catch (error) {
    logError("[approveTestimonial] Greška pri odobravanju testimoniala", error, {
      testimonialId: req.params.testimonialId,
      userId: req.session?.user?.id,
    });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/testimoniali/detalji/${req.params.testimonialId}`);
    }
    next(error);
  }
}

export async function rejectTestimonial(req, res, next) {
  try {
    const { testimonialId } = req.params;
    await testimonialService.rejectTestimonial(testimonialId);
    logInfo(`[rejectTestimonial] Testimonijal #${testimonialId} odbijen`, { testimonialId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Testimonijal je odbijen", `/admin/testimoniali/detalji/${testimonialId}`);
  } catch (error) {
    logError("[rejectTestimonial] Greška pri odbijanju testimoniala", error, {
      testimonialId: req.params.testimonialId,
      userId: req.session?.user?.id,
    });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/testimoniali/detalji/${req.params.testimonialId}`);
    }
    next(error);
  }
}

export async function deleteTestimonial(req, res, next) {
  try {
    const { testimonialId } = req.params;
    await testimonialService.deleteTestimonialById(testimonialId);
    logInfo(`[deleteTestimonial] Testimonijal #${testimonialId} obrisan`, { testimonialId, adminId: req.session?.user?.id });
    return flashAndRedirect(req, res, "success", "Testimonijal je uspešno obrisan", "/admin/testimoniali");
  } catch (error) {
    logError("[deleteTestimonial] Greška pri brisanju testimoniala", error, {
      testimonialId: req.params.testimonialId,
      userId: req.session?.user?.id,
    });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, "/admin/testimoniali");
    }
    next(error);
  }
}

export default {
  listTestimonials,
  testimonialDetails,
  approveTestimonial,
  rejectTestimonial,
  deleteTestimonial,
};