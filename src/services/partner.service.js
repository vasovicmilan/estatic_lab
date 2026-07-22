import partnerRepo from "../repositories/partner.repository.js";
import userRepo from "../repositories/user.repository.js";
import roleService from "./role.service.js";
import { mapPartner, mapPartnersForAdminList, mapPartnerForEdit } from "../mappers/partner.mapper.js";
import { validationError, notFound, conflict, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

const defaultPopulate = [{ path: "userId", select: "firstName lastName email phone" }];

export async function listPartners({ limit = 10, page = 1, filters = {}, role = "admin" } = {}) {
  const result = await partnerRepo.findPartners({ limit, page, filters, populateFields: defaultPopulate });
  return {
    data: role === "admin" ? mapPartnersForAdminList(result.data) : result.data.map((p) => mapPartner(p, role, "short")),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  };
}

export async function getPartnerById(partnerId, role = "admin", viewType = "detail") {
  if (!partnerId) validationError("partnerId");
  const partner = await partnerRepo.findPartnerById(partnerId, { populateFields: defaultPopulate });
  if (!partner) notFound("Partner");
  return mapPartner(partner, role, viewType);
}

// raw-shaped (IDs, not display strings) - used to pre-fill the admin edit form
export async function getPartnerForEdit(partnerId) {
  if (!partnerId) validationError("partnerId");
  const partner = await partnerRepo.findPartnerById(partnerId, { populateFields: defaultPopulate });
  if (!partner) notFound("Partner");
  return mapPartnerForEdit(partner);
}

export async function findPartnerByUserId(userId) {
  if (!userId) validationError("userId");
  return partnerRepo.findPartnerByUserId(userId, { populateFields: defaultPopulate });
}

export async function findPartnerProfile(userId) {
  const partner = await findPartnerByUserId(userId);
  if (!partner) notFound("Profil partnera");
  return mapPartner(partner, "partner", "detail");
}

// creates the Partner record AND promotes the target User's role to "partner"
export async function createPartner(data) {
  if (!data) validationError("data");
  if (!data.userId) validationError("userId");
  if (data.commissionRate === undefined || data.commissionRate === null) validationError("commissionRate");
  if (data.commissionRate < 0 || data.commissionRate > 100) badRequest("Procenat provizije mora biti između 0 i 100");

  const existing = await partnerRepo.findPartnerByUserId(data.userId);
  if (existing) conflict("Ovaj korisnik već ima profil partnera");

  const partnerRole = await roleService.findRoleByName("partner");
  if (!partnerRole) badRequest("Rola 'partner' nije konfigurisana");

  const created = await partnerRepo.createPartner({
    userId: data.userId,
    commissionRate: data.commissionRate,
    isActive: data.isActive ?? true,
    notes: data.notes || "",
  });

  // Only promote the user's role to "partner" - never downgrade someone who
  // already holds a role of equal or higher priority. Same safeguard as
  // createEmployee, for the same reason: role is a single field on User, not a
  // set of roles, so this could otherwise silently strip an existing admin/
  // employee role.
  const targetUser = await userRepo.findUserById(data.userId, { populateFields: ["role"] });
  const currentPriority = targetUser?.role?.priority ?? 0;
  if (currentPriority < partnerRole.priority) {
    await userRepo.updateUserById(data.userId, { role: partnerRole._id });
  } else {
    logInfo("Partner profile created without changing role (existing role has equal/higher priority)", {
      userId: data.userId,
      currentRole: targetUser?.role?.name,
    });
  }

  logInfo("Partner created", { partnerId: created._id, userId: data.userId, commissionRate: data.commissionRate });
  return getPartnerById(created._id);
}

export async function updatePartnerById(partnerId, data) {
  if (!partnerId) validationError("partnerId");
  if (data.commissionRate !== undefined && (data.commissionRate < 0 || data.commissionRate > 100)) {
    badRequest("Procenat provizije mora biti između 0 i 100");
  }

  const updated = await partnerRepo.updatePartnerById(partnerId, data);
  if (!updated) notFound("Partner");
  logInfo("Partner updated", { partnerId, updatedFields: Object.keys(data) });
  return getPartnerById(partnerId);
}

export async function deletePartnerById(partnerId) {
  if (!partnerId) validationError("partnerId");
  const existing = await partnerRepo.findPartnerById(partnerId);
  if (!existing) notFound("Partner");
  await partnerRepo.deletePartnerById(partnerId);
  logInfo("Partner deleted", { partnerId });
  return { success: true };
}

// every userId that already has a Partner profile - used by the admin
// controller to exclude them from the "promote this user" dropdown, same
// reasoning as employee.service.js's getAllEmployeeUserIds
export async function getAllPartnerUserIds() {
  return partnerRepo.findAllPartnerUserIds();
}

export default {
  listPartners,
  getPartnerById,
  getPartnerForEdit,
  findPartnerByUserId,
  findPartnerProfile,
  createPartner,
  updatePartnerById,
  deletePartnerById,
  getAllPartnerUserIds,
};