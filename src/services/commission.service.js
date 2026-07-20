import commissionRepo from "../repositories/commission-entry.repository.js";
import appointmentRepo from "../repositories/appointment.repository.js";
import orderRepo from "../repositories/order.repository.js";
import { ORDER_COMMISSION_GRACE_PERIOD_DAYS } from "../config/shop.config.js";
import { logInfo, logError } from "../utils/logger.util.js";

const ORDER_TERMINAL_NO_COMMISSION_STATUSES = ["cancelled", "returned", "refunded"];

/**
 * Called when an appointment is marked completed. Checks for two independent,
 * non-exclusive commission sources - a commission-based employee who performed
 * it, and/or a partner whose referral coupon was used - and records an "earned"
 * entry for either/both that apply. Appointment commissions skip the "pending"
 * grace period entirely: a rendered service has nothing left to reverse against,
 * unlike an order that could still be returned.
 */
export async function recordAppointmentCommissions(appointmentId) {
  const appointment = await appointmentRepo.findAppointmentById(appointmentId, {
    populateFields: ["employee", { path: "coupon", populate: "partner" }],
  });
  if (!appointment) return;

  const baseValue = appointment.finalPrice || 0;
  if (baseValue <= 0) return;

  const entries = [];

  if (appointment.employee?.payType === "commission" && appointment.employee.commissionRate) {
    entries.push({
      earnerType: "employee",
      employee: appointment.employee._id,
      sourceType: "appointment",
      appointment: appointment._id,
      baseValue,
      rate: appointment.employee.commissionRate,
      amount: round2(baseValue * (appointment.employee.commissionRate / 100)),
      status: "earned",
      earnedAt: new Date(),
    });
  }

  if (appointment.coupon?.partner) {
    const partner = appointment.coupon.partner;
    entries.push({
      earnerType: "partner",
      partner: partner._id || partner,
      sourceType: "appointment",
      appointment: appointment._id,
      baseValue,
      rate: partner.commissionRate ?? 0,
      amount: round2(baseValue * ((partner.commissionRate ?? 0) / 100)),
      status: "earned",
      earnedAt: new Date(),
    });
  }

  for (const entry of entries) {
    await commissionRepo.createCommissionEntry(entry);
  }
  if (entries.length) {
    logInfo("Commission recorded for completed appointment", { appointmentId, count: entries.length });
  }
}

/**
 * Called when an order is confirmed. Only a partner-referred order generates a
 * commission (employees aren't tied to orders in this system - there's no
 * fulfillment assignment concept for a self-service purchase). Recorded as
 * "pending", not "earned" - see processGracePeriodCommissions for how it resolves.
 */
export async function recordOrderCommission(orderId) {
  const order = await orderRepo.findOrderById(orderId, { populateFields: [{ path: "coupon", populate: "partner" }] });
  if (!order || !order.coupon?.partner) return;

  const baseValue = order.totalPrice || 0;
  if (baseValue <= 0) return;

  const partner = order.coupon.partner;
  await commissionRepo.createCommissionEntry({
    earnerType: "partner",
    partner: partner._id || partner,
    sourceType: "order",
    order: order._id,
    baseValue,
    rate: partner.commissionRate ?? 0,
    amount: round2(baseValue * ((partner.commissionRate ?? 0) / 100)),
    status: "pending",
  });

  logInfo("Pending commission recorded for confirmed order", { orderId, partnerId: partner._id || partner });
}

/**
 * Cron target (see jobs/commission-jobs.js). Every pending order-sourced entry
 * either resolves to "earned" (grace period passed, order still valid) or
 * "reversed" (the order was cancelled/returned/refunded before the window closed).
 */
export async function processGracePeriodCommissions() {
  const pending = await commissionRepo.findPendingOrderCommissions();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ORDER_COMMISSION_GRACE_PERIOD_DAYS);

  let earned = 0;
  let reversed = 0;
  let stillPending = 0;

  for (const entry of pending) {
    try {
      const order = entry.order;
      if (!order) {
        await commissionRepo.updateCommissionEntryById(entry._id, {
          status: "reversed",
          reversedAt: new Date(),
          reversalReason: "Porudžbina više ne postoji",
        });
        reversed += 1;
        continue;
      }

      if (ORDER_TERMINAL_NO_COMMISSION_STATUSES.includes(order.status)) {
        await commissionRepo.updateCommissionEntryById(entry._id, {
          status: "reversed",
          reversedAt: new Date(),
          reversalReason: `Porudžbina je u statusu "${order.status}"`,
        });
        reversed += 1;
        continue;
      }

      const orderConfirmedAt = new Date(order.createdAt);
      if (orderConfirmedAt <= cutoff) {
        await commissionRepo.updateCommissionEntryById(entry._id, { status: "earned", earnedAt: new Date() });
        earned += 1;
      } else {
        stillPending += 1;
      }
    } catch (error) {
      logError("Failed to resolve a pending commission entry", error, { commissionEntryId: entry._id });
    }
  }

  logInfo("Commission grace-period sweep complete", { total: pending.length, earned, reversed, stillPending });
  return { total: pending.length, earned, reversed, stillPending };
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

export default { recordAppointmentCommissions, recordOrderCommission, processGracePeriodCommissions };