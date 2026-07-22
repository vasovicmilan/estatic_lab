import payoutRepo from "../repositories/payout-request.repository.js";
import commissionRepo from "../repositories/commission-entry.repository.js";
import { mapPayoutRequestsForAdminList, mapPayoutRequestForAdminDetail } from "../mappers/payout-request.mapper.js";
import { validationError, notFound, badRequest } from "../utils/error.util.js";
import { logInfo } from "../utils/logger.util.js";

/**
 * The available (payable) balance for one earner: everything actually earned,
 * minus everything already paid out, minus anything currently requested/approved
 * but not yet paid (so the same money can't be requested twice while a first
 * request is still pending admin action).
 */
export async function getBalance(earnerType, earnerId) {
  if (!["employee", "partner"].includes(earnerType)) validationError("earnerType");
  const ref = earnerType === "employee" ? { employee: earnerId } : { partner: earnerId };

  const [earned, reserved, paid] = await Promise.all([
    commissionRepo.sumEarnedAmount(ref),
    payoutRepo.sumPendingRequestedAmount(ref), // requested + approved, not yet paid
    payoutRepo.sumPaidAmount(ref), // already paid out - permanently reduces the balance
  ]);

  return {
    earned,
    paid,
    reserved,
    available: Math.max(0, earned - paid - reserved),
  };
}

/**
 * The earner-initiated request path - validated against their own derived
 * balance so they can't request more than they've actually earned.
 */
export async function requestPayout(earnerType, earnerId, amount) {
  if (!amount || amount <= 0) badRequest("Iznos mora biti veći od nule");

  const balance = await getBalance(earnerType, earnerId);
  if (amount > balance.available) badRequest("Traženi iznos prevazilazi raspoloživo stanje");

  const created = await payoutRepo.createPayoutRequest({
    earnerType,
    ...(earnerType === "employee" ? { employee: earnerId } : { partner: earnerId }),
    amount,
    status: "requested",
  });

  logInfo("Payout requested", { earnerType, earnerId, amount });
  return created;
}

/**
 * The admin-initiated path - directly recording a payout that's about to happen
 * (or already has), skipping the "requested" step entirely. Still validated
 * against the balance - admin recording an amount they don't actually owe would
 * be a real bug worth catching, not something to silently allow.
 */
export async function recordPayoutByAdmin(earnerType, earnerId, amount, adminNote = "") {
  if (!amount || amount <= 0) badRequest("Iznos mora biti veći od nule");

  const balance = await getBalance(earnerType, earnerId);
  if (amount > balance.available) badRequest("Iznos prevazilazi raspoloživo stanje");

  const created = await payoutRepo.createPayoutRequest({
    earnerType,
    ...(earnerType === "employee" ? { employee: earnerId } : { partner: earnerId }),
    amount,
    status: "paid",
    approvedAt: new Date(),
    paidAt: new Date(),
    adminNote,
  });

  logInfo("Payout recorded directly by admin", { earnerType, earnerId, amount });
  return created;
}

export async function approvePayoutRequest(requestId, adminNote = "") {
  const request = await payoutRepo.findPayoutRequestById(requestId);
  if (!request) notFound("Zahtev za isplatu");
  if (request.status !== "requested") badRequest(`Zahtev je već u statusu "${request.status}"`);

  const updated = await payoutRepo.updatePayoutRequestById(requestId, { status: "approved", approvedAt: new Date(), adminNote });
  logInfo("Payout request approved", { requestId });
  return updated;
}

export async function markPayoutRequestPaid(requestId, adminNote = "") {
  const request = await payoutRepo.findPayoutRequestById(requestId);
  if (!request) notFound("Zahtev za isplatu");
  if (!["requested", "approved"].includes(request.status)) badRequest(`Zahtev je već u statusu "${request.status}"`);

  const updated = await payoutRepo.updatePayoutRequestById(requestId, { status: "paid", paidAt: new Date(), adminNote });
  logInfo("Payout request marked paid", { requestId });
  return updated;
}

export async function rejectPayoutRequest(requestId, adminNote = "") {
  const request = await payoutRepo.findPayoutRequestById(requestId);
  if (!request) notFound("Zahtev za isplatu");
  if (request.status === "paid") badRequest("Isplaćen zahtev se ne može odbiti");

  const updated = await payoutRepo.updatePayoutRequestById(requestId, { status: "rejected", rejectedAt: new Date(), adminNote });
  logInfo("Payout request rejected", { requestId });
  return updated;
}

export async function listPayoutRequests({ limit = 20, page = 1, filters = {} } = {}) {
  const result = await payoutRepo.findPayoutRequests({ limit, page, filters });
  return { data: mapPayoutRequestsForAdminList(result.data), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export async function getPayoutRequestById(requestId) {
  const request = await payoutRepo.findPayoutRequestById(requestId);
  if (!request) notFound("Zahtev za isplatu");
  return mapPayoutRequestForAdminDetail(request);
}

export default {
  getBalance,
  requestPayout,
  recordPayoutByAdmin,
  approvePayoutRequest,
  markPayoutRequestPaid,
  rejectPayoutRequest,
  listPayoutRequests,
  getPayoutRequestById,
};