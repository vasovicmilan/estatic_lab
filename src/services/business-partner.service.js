import businessPartnerRepo from "../repositories/business-partner.repository.js";
import {
  mapBusinessPartnersForAdminList,
  mapBusinessPartnerForAdminDetail,
  mapBusinessPartnerForEdit,
  mapBusinessPartnersForPublicList,
  mapBusinessPartnerForPublicDetail,
} from "../mappers/business-partner.mapper.js";
import { generateUniqueSlug } from "../utils/slug.util.js";
import { validationError, notFound, conflict } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";
import { buildPageSeo } from "../seo/index.js";

export async function listBusinessPartners({ search = "", filters = {}, limit = 10, page = 1 } = {}) {
  const result = await businessPartnerRepo.findBusinessPartners({ search, limit, page, filters });
  return { data: mapBusinessPartnersForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getBusinessPartnerById(partnerId) {
  if (!partnerId) validationError("partnerId");
  const partner = await businessPartnerRepo.findBusinessPartnerById(partnerId);
  if (!partner) notFound("Saradnik");
  return mapBusinessPartnerForAdminDetail(partner);
}

export async function getBusinessPartnerForEdit(partnerId) {
  if (!partnerId) validationError("partnerId");
  const partner = await businessPartnerRepo.findBusinessPartnerById(partnerId);
  if (!partner) notFound("Saradnik");
  return mapBusinessPartnerForEdit(partner);
}

export async function createBusinessPartner(data) {
  if (!data.name) validationError("name");
  if (!data.shortDescription) validationError("shortDescription");
  if (!data.coverImage) validationError("coverImage");
  if (!data.outboundUrl) validationError("outboundUrl");

  if (data.slug) {
    const existing = await businessPartnerRepo.findBusinessPartnerBySlug(data.slug);
    if (existing) conflict("Saradnik sa ovim slug-om već postoji");
  } else {
    data.slug = await generateUniqueSlug(data.name, (candidate) => businessPartnerRepo.findBusinessPartnerBySlug(candidate));
  }

  const created = await businessPartnerRepo.createBusinessPartner(data);
  logInfo("Business partner created", { partnerId: created._id, name: created.name });
  return getBusinessPartnerById(created._id);
}

export async function updateBusinessPartnerById(partnerId, data) {
  if (!partnerId) validationError("partnerId");
  const existing = await businessPartnerRepo.findBusinessPartnerById(partnerId);
  if (!existing) notFound("Saradnik");

  if (data.slug && data.slug !== existing.slug) {
    const conflicting = await businessPartnerRepo.findBusinessPartnerBySlug(data.slug);
    if (conflicting) conflict("Saradnik sa ovim slug-om već postoji");
  }

  const updated = await businessPartnerRepo.updateBusinessPartnerById(partnerId, data);
  logInfo("Business partner updated", { partnerId, updatedFields: Object.keys(data) });
  return getBusinessPartnerById(updated._id);
}

export async function deleteBusinessPartnerById(partnerId) {
  if (!partnerId) validationError("partnerId");
  const existing = await businessPartnerRepo.findBusinessPartnerById(partnerId);
  if (!existing) notFound("Saradnik");
  await businessPartnerRepo.deleteBusinessPartnerById(partnerId);
  logInfo("Business partner deleted", { partnerId });
  return { success: true };
}

export async function listPublicBusinessPartners() {
  const partners = await businessPartnerRepo.findActiveBusinessPartners();
  // Dok nema okačenih saradnika, stranica nema realan sadržaj za crawler - noindex
  // privremeno; čim se doda prvi aktivan saradnik, automatski postaje index, follow.
  const seo = buildPageSeo({
    title: "Naši saradnici | Estetik Lab",
    description: "Upoznajte poslovne saradnike i partnere sa kojima sarađujemo.",
    canonical: "/saradnici",
    isIndexable: partners.length > 0,
    type: "website",
  });
  return { data: mapBusinessPartnersForPublicList(partners), seo };
}

export async function getPublicBusinessPartnerBySlug(slug) {
  if (!slug) validationError("slug");
  const partner = await businessPartnerRepo.findBusinessPartnerBySlug(slug);
  if (!partner || !partner.isActive) notFound("Saradnik");
  const mapped = mapBusinessPartnerForPublicDetail(partner);
  const seo = buildPageSeo({
    title: mapped.seo?.title || `${mapped.naziv} | Estetik Lab`,
    description: mapped.seo?.description || mapped.kratakOpis,
    canonical: `/saradnici/${mapped.slug}`,
    isIndexable: true,
    type: "website",
    image: mapped.slika?.url,
  });
  return { ...mapped, seo };
}

export async function listSlugsForSitemap() {
  return businessPartnerRepo.findActiveSlugsForSitemap();
}

export default {
  listBusinessPartners,
  getBusinessPartnerById,
  getBusinessPartnerForEdit,
  createBusinessPartner,
  updateBusinessPartnerById,
  deleteBusinessPartnerById,
  listPublicBusinessPartners,
  getPublicBusinessPartnerBySlug,
  listSlugsForSitemap,
};
