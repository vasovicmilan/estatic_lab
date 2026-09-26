import eventEmitter from "../events/event.emitter.js";
import payoutRepo from "../repositories/payout-request.repository.js";
import commissionService from "./commission.service.js";
import employeeService from "./employee.service.js";
import { mapPayoutRequestsForAdminList, mapPayoutRequestForAdminDetail } from "../mappers/payout-request.mapper.js";
import { validationError, notFound, badRequest, conflict } from "../utils/error.util.js";
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
    commissionService.getEarnedTotal(ref),
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
    ...(earnerType === "employee"
      ? { employee: earnerId, employeeSnapshot: { name: await employeeService.getEmployeeNameById(earnerId) } }
      : { partner: earnerId }),
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
    ...(earnerType === "employee"
      ? { employee: earnerId, employeeSnapshot: { name: await employeeService.getEmployeeNameById(earnerId) } }
      : { partner: earnerId }),
    amount,
    status: "paid",
    approvedAt: new Date(),
    paidAt: new Date(),
    adminNote,
  });

  logInfo("Payout recorded directly by admin", { earnerType, earnerId, amount });
  return created;
}

// Below, each status transition uses a single atomic findOneAndUpdate whose
// filter names the CURRENT status(es) it's allowed to come from, instead of
// the previous read-check-then-write sequence (find, inspect .status in JS,
// separate update). That old sequence had a window between the read and the
// write: two near-simultaneous requests for the same payout request (e.g. two
// admin tabs, or a double-click submitting the same form twice) could both
// read "requested"/"approved", both pass the status check, and both go on to
// write - the second write silently re-applying (or worse, re-stamping
// paidAt/emitting a second "paid" event/paying out twice at the caller's
// integration level) something that was already handled by the first.
//
// Only one PayoutRequest document is involved in a single transition (there's
// no separate "mark these commission entries paid" write - see getBalance's
// comment: paid/pending payout requests are what commission balance is
// computed against, not a flag on the commission entries themselves), so a
// multi-document Mongoose transaction isn't needed here - Mongo's per-document
// write serialization already makes a single findOneAndUpdate atomic: of two
// racing calls, only the one that still matches the filter's status can flip
// it, and the other gets `null` back and must treat that as "already handled
// by someone else", not "nothing changed, move on".
export async function approvePayoutRequest(requestId, adminNote = "") {
  const updated = await payoutRepo.updatePayoutRequestStatusAtomic(requestId, "requested", {
    status: "approved",
    approvedAt: new Date(),
    adminNote,
  });

  if (!updated) {
    const existing = await payoutRepo.findPayoutRequestById(requestId);
    if (!existing) notFound("Zahtev za isplatu");
    conflict(`Zahtev je već u statusu "${existing.status}"`);
  }

  logInfo("Payout request approved", { requestId });
  eventEmitter.emit("payout:status_changed", { payoutRequest: updated, status: "approved" });
  return updated;
}

export async function markPayoutRequestPaid(requestId, adminNote = "") {
  const updated = await payoutRepo.updatePayoutRequestStatusAtomic(requestId, { $in: ["requested", "approved"] }, {
    status: "paid",
    paidAt: new Date(),
    adminNote,
  });

  if (!updated) {
    const existing = await payoutRepo.findPayoutRequestById(requestId);
    if (!existing) notFound("Zahtev za isplatu");
    // Whoever lost the race lands here - the request is no longer in a
    // payable status by the time this call's filter was evaluated, because
    // another request already flipped it (most often to "paid" itself, in
    // the exact double-submission this guards against). Surfaced as a
    // conflict, not a silent success and not a generic "already paid" that
    // would look identical to a normal repeat click on an already-settled row.
    conflict(`Zahtev je već obrađen (status: "${existing.status}") - isplata nije ponovo izvršena`);
  }

  logInfo("Payout request marked paid", { requestId });
  eventEmitter.emit("payout:status_changed", { payoutRequest: updated, status: "paid" });
  return updated;
}

export async function rejectPayoutRequest(requestId, adminNote = "") {
  const updated = await payoutRepo.updatePayoutRequestStatusAtomic(requestId, { $ne: "paid" }, {
    status: "rejected",
    rejectedAt: new Date(),
    adminNote,
  });

  if (!updated) {
    const existing = await payoutRepo.findPayoutRequestById(requestId);
    if (!existing) notFound("Zahtev za isplatu");
    conflict("Isplaćen zahtev se ne može odbiti");
  }

  logInfo("Payout request rejected", { requestId });
  eventEmitter.emit("payout:status_changed", { payoutRequest: updated, status: "rejected" });
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

/**
 * The earner's own payout request history - a clean minimal shape distinct from
 * listPayoutRequests (which returns the admin-display shape: earnerType,
 * earnerName - redundant/awkward for someone viewing their own requests - and
 * doesn't include adminNote at all, which is exactly the reason/context the
 * earner needs to see when a request is rejected or approved).
 */
export async function listPayoutRequestsForEarner({ employee = null, partner = null, status = null, limit = 10, page = 1 } = {}) {
  const result = await payoutRepo.findPayoutRequests({ filters: { employee, partner, status }, limit, page });
  return {
    data: result.data.map((r) => ({
      id: r._id.toString(),
      amount: r.amount,
      status: r.status,
      adminNote: r.adminNote || null,
      requestedAt: r.requestedAt || r.createdAt,
      approvedAt: r.approvedAt || null,
      paidAt: r.paidAt || null,
      rejectedAt: r.rejectedAt || null,
    })),
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
  };
}

export default {
  getBalance,
  requestPayout,
  recordPayoutByAdmin,
  approvePayoutRequest,
  markPayoutRequestPaid,
  rejectPayoutRequest,
  listPayoutRequests,
  listPayoutRequestsForEarner,
  getPayoutRequestById,
};