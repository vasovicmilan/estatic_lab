import expertRepo from "../repositories/expert.repository.js";
import {
  mapExpertsForAdminList,
  mapExpertForAdminDetail,
  mapExpertForEdit,
  mapExpertsForPublic,
  mapExpertForPublicDetail,
} from "../mappers/expert.mapper.js";
import { generateUniqueSlug } from "../utils/slug.util.js";
import { validationError, notFound, conflict } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

const populate = [{ path: "services", select: "name slug" }];

export async function listExperts({ search = "", limit = 10, page = 1, filters = {} } = {}) {
  const result = await expertRepo.findExperts({ search, limit, page, filters, populateFields: populate });
  return { data: mapExpertsForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getExpertById(expertId) {
  if (!expertId) validationError("expertId");
  const expert = await expertRepo.findExpertById(expertId);
  if (!expert) notFound("Ekspert");
  return mapExpertForAdminDetail(expert);
}

export async function getExpertForEdit(expertId) {
  if (!expertId) validationError("expertId");
  const expert = await expertRepo.findExpertById(expertId);
  if (!expert) notFound("Ekspert");
  return mapExpertForEdit(expert);
}

export async function getExpertBySlug(slug) {
  if (!slug) validationError("slug");
  const expert = await expertRepo.findExpertBySlug(slug);
  if (!expert || !expert.isActive) notFound("Ekspert");
  return mapExpertForPublicDetail(expert);
}

// public "our experts" team page
export async function getActiveExperts() {
  const experts = await expertRepo.findActiveExperts();
  return mapExpertsForPublic(experts);
}

export async function createExpert(data) {
  if (!data) validationError("data");
  if (!data.firstName) validationError("firstName");
  if (!data.lastName) validationError("lastName");
  if (!data.image?.img) validationError("image");

  if (data.slug) {
    const existing = await expertRepo.findExpertBySlug(data.slug);
    if (existing) conflict("Ekspert sa ovim slug-om već postoji");
  } else {
    data.slug = await generateUniqueSlug(`${data.firstName} ${data.lastName}`, (candidate) => expertRepo.findExpertBySlug(candidate));
  }

  const created = await expertRepo.createExpert(data);
  logInfo("Expert created", { expertId: created._id, name: `${created.firstName} ${created.lastName}` });
  return getExpertById(created._id);
}

export async function updateExpertById(expertId, data) {
  if (!expertId) validationError("expertId");

  if (data.slug) {
    const existing = await expertRepo.findExpertBySlug(data.slug);
    if (existing && String(existing._id) !== String(expertId)) conflict("Ekspert sa ovim slug-om već postoji");
  }

  const updated = await expertRepo.updateExpertById(expertId, data);
  if (!updated) notFound("Ekspert");
  logInfo("Expert updated", { expertId, updatedFields: Object.keys(data) });
  return getExpertById(expertId);
}

export async function deleteExpertById(expertId) {
  if (!expertId) validationError("expertId");
  const existing = await expertRepo.findExpertById(expertId);
  if (!existing) notFound("Ekspert");
  await expertRepo.deleteExpertById(expertId);
  logInfo("Expert deleted", { expertId });
  return { success: true };
}

export default {
  listExperts,
  getExpertById,
  getExpertForEdit,
  getExpertBySlug,
  getActiveExperts,
  createExpert,
  updateExpertById,
  deleteExpertById,
};