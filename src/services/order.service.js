import mongoose from "mongoose";
import eventEmitter from "../events/event.emitter.js";
import orderRepo from "../repositories/order.repository.js";
import tempOrderService from "./temporary-order.service.js";
import productService from "./product.service.js";
import couponService from "./coupon.service.js";
import { generateRandomToken } from "./crypto.service.js";
import { mapOrder, mapOrdersForAdminList } from "../mappers/order.mapper.js";
import { getAllowedStatuses, canUserCancelOrder, canEditContactInfo } from "../models/order-status-transitions.js";
import { buildPhoneRecord } from "../utils/phone.util.js";
import { buildAddressRecord } from "../utils/address.util.js";
import { validationError, notFound, forbidden, badRequest } from "../utils/error.util.js";
import { logInfo, logError } from "../utils/logger.util.js";

function canAccessOrder(order, requesterId, requesterRole) {
  if (requesterRole === "admin") return true;
  const userId = order.user?._id?.toString() || order.user?.toString();
  return userId === String(requesterId);
}

// ==================== CONFIRM (temp order -> real order) ====================

/**
 * Turns a verified TemporaryOrder into a real Order. Stock was already reserved at
 * checkout time (see temporary-order.service.js) - this does NOT touch stock again.
 * The coupon, if any, IS redeemed here (not at checkout) - see the note on
 * temporary-order.service.js for why redemption is deliberately deferred to this point.
 * Deleting the temp order acts as the idempotency guard: if two confirm requests race
 * (e.g. a double-clicked email link, or a customer confirming right as an admin does
 * it manually), the second delete finds nothing, throws, and the transaction aborts -
 * only one Order is ever created. Shared by both confirmOrder (customer, token-gated)
 * and confirmOrderByAdmin (admin, ID-gated) below.
 */
async function createOrderFromTemporaryOrder(tempOrder) {
  const session = await mongoose.startSession();
  let created;
  const cancelToken = generateRandomToken(24);

  try {
    await session.withTransaction(async () => {
      created = await orderRepo.createOrder(
        {
          user: tempOrder.user,
          contactSnapshot: tempOrder.contactSnapshot,
          phone: tempOrder.phone,
          address: tempOrder.address,
          items: tempOrder.items,
          subtotal: tempOrder.subtotal,
          shipping: tempOrder.shipping,
          coupon: tempOrder.coupon,
          discountApplied: tempOrder.discountApplied || 0,
          note: tempOrder.note,
          status: "pending",
          cancelToken,
        },
        { session }
      );

      if (tempOrder.coupon) {
        await couponService.redeemCoupon(
          tempOrder.coupon,
          { userId: tempOrder.user, orderId: created._id, discountAmount: tempOrder.discountApplied || 0 },
          { session }
        );
      }

      await tempOrderService.deleteTemporaryOrder(tempOrder.temporaryOrderId, { session });
    });
  } catch (error) {
    logError("Order confirmation transaction failed", error, { temporaryOrderId: tempOrder.temporaryOrderId });
    throw error;
  } finally {
    await session.endSession();
  }

  logInfo("Order confirmed", { orderId: created._id, userId: String(tempOrder.user) });

  eventEmitter.emit("order:confirmed", {
    orderId: created._id.toString(),
    email: tempOrder.contactSnapshot.email,
    firstName: tempOrder.contactSnapshot.firstName,
  });

  return created;
}

export async function confirmOrder(orderId, token, { ignoreExpiration = false } = {}) {
  const tempOrder = await tempOrderService.verifyToken(orderId, token, { ignoreExpiration });
  const created = await createOrderFromTemporaryOrder(tempOrder);

  const populated = await orderRepo.findOrderById(created._id);
  return mapOrder(populated, "user", "detail");
}

/**
 * Admin-triggered confirmation - for the "customer missed the email / token expired,
 * but reached out and still wants the order" case. Deliberately does NOT require the
 * token: an admin looking at a temporary order in the admin panel has no practical way
 * to know the emailed token value, and shouldn't need it - admin access to the route
 * itself is the authorization here, same as every other admin action in this app.
 * Only works while the record still exists, i.e. within the retention window (see
 * shop.config.js's TEMP_ORDER_RETENTION_HOURS and the cleanup job) - once that passes
 * and stock has been released back, there's nothing left to confirm.
 */
export async function confirmOrderByAdmin(orderId, adminId) {
  const rawTempOrder = await tempOrderService.getTemporaryOrderRawById(orderId);
  const tempOrder = { ...rawTempOrder, temporaryOrderId: rawTempOrder._id.toString() };
  const created = await createOrderFromTemporaryOrder(tempOrder);

  logInfo("Order confirmed by admin", { orderId: created._id, adminId });

  const populated = await orderRepo.findOrderById(created._id);
  return mapOrder(populated, "admin", "detail");
}

// ==================== READ ====================

export async function findOrders({ search = "", limit = 20, page = 1, requesterId = null, role = "user", filters = {} } = {}) {
  const scopedFilters = { ...filters };
  if (role === "user") scopedFilters.user = requesterId;

  const result = await orderRepo.findOrders({ search, limit, page, filters: scopedFilters });

  return {
    data: role === "admin" ? mapOrdersForAdminList(result.data) : result.data.map((o) => mapOrder(o, role, "short")),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  };
}

export async function getOrderById(orderId, requesterId, role) {
  if (!orderId) validationError("orderId");
  const order = await orderRepo.findOrderById(orderId);
  if (!order) notFound("Porudžbina");
  if (!canAccessOrder(order, requesterId, role)) forbidden("Nemate pristup ovoj porudžbini");
  return mapOrder(order, role, "detail");
}

export async function getOrderByCancelToken(token) {
  if (!token) validationError("token");
  const order = await orderRepo.findOrderByCancelToken(token);
  if (!order) notFound("Porudžbina");
  return mapOrder(order, "user", "detail");
}

// ==================== STATUS TRANSITIONS ====================

const STATUS_TIMESTAMP_FIELD = {
  processing: "processingAt",
  shipped: "shippedAt",
  delivered: "deliveredAt",
  completed: "completedAt",
  cancelled: "cancelledAt",
  returned: "returnedAt",
  refunded: "refundedAt",
};

async function transitionStatus(orderId, nextStatus, actorId, actorRole, extra = {}) {
  const order = await orderRepo.findOrderById(orderId);
  if (!order) notFound("Porudžbina");
  if (!canAccessOrder(order, actorId, actorRole)) forbidden("Nemate pristup ovoj porudžbini");

  const allowed = getAllowedStatuses(order.status, actorRole);
  if (!allowed.includes(nextStatus)) {
    badRequest(`Prelaz iz statusa "${order.status}" u "${nextStatus}" nije dozvoljen`);
  }

  const timestampField = STATUS_TIMESTAMP_FIELD[nextStatus];
  const updateData = { status: nextStatus, ...extra };
  if (timestampField) updateData[timestampField] = new Date();

  // cancelling/returning an unshipped-or-returned order gives the reserved stock back
  if (nextStatus === "cancelled" || nextStatus === "returned") {
    for (const item of order.items) {
      await productService.restoreVariationStock(item.product, item.variant, item.quantity);
    }
  }

  const updated = await orderRepo.updateOrderById(orderId, updateData);
  logInfo("Order status changed", { orderId, from: order.status, to: nextStatus, actorId, actorRole });

  eventEmitter.emit("order:status_changed", { orderId, status: nextStatus, previousStatus: order.status });

  const populated = await orderRepo.findOrderById(orderId);
  return mapOrder(populated, actorRole, "detail");
}

export async function markProcessing(orderId, actorId) {
  return transitionStatus(orderId, "processing", actorId, "admin");
}

export async function markShipped(orderId, actorId) {
  return transitionStatus(orderId, "shipped", actorId, "admin");
}

export async function markDelivered(orderId, actorId) {
  return transitionStatus(orderId, "delivered", actorId, "admin");
}

export async function markCompleted(orderId, actorId) {
  return transitionStatus(orderId, "completed", actorId, "admin");
}

export async function markReturned(orderId, reason, actorId) {
  return transitionStatus(orderId, "returned", actorId, "admin", { returnReason: reason || "" });
}

export async function markRefunded(orderId, actorId) {
  return transitionStatus(orderId, "refunded", actorId, "admin");
}

export async function cancelOrder(orderId, reason, actorId, actorRole) {
  if (actorRole === "user") {
    const order = await orderRepo.findOrderById(orderId);
    if (!order) notFound("Porudžbina");
    if (!canUserCancelOrder(order.status)) {
      badRequest("Porudžbina se više ne može otkazati - obrada je već započeta");
    }
  }

  return transitionStatus(orderId, "cancelled", actorId, actorRole, {
    cancelledBy: actorRole === "admin" ? "admin" : "user",
    cancelledAt: new Date(),
    cancellationReason: reason || "",
  });
}

export async function reopenOrder(orderId, actorId) {
  return transitionStatus(orderId, "pending", actorId, "admin");
}

export async function updateOrderContactInfo(orderId, { phone, address } = {}) {
  if (!orderId) validationError("orderId");
  const order = await orderRepo.findOrderById(orderId);
  if (!order) notFound("Porudžbina");

  if (!canEditContactInfo(order.status)) {
    badRequest(`Kontakt informacije se ne mogu menjati u statusu: ${order.status}`);
  }

  const updateData = {};
  if (phone) updateData.phone = buildPhoneRecord(phone);
  if (address) {
    if (!address.city || !address.street || !address.number || !address.postalCode) validationError("address");
    updateData.address = buildAddressRecord(address);
  }
  if (Object.keys(updateData).length === 0) validationError("data");

  const updated = await orderRepo.updateOrderById(orderId, updateData);
  logInfo("Order contact info updated", { orderId });
  return mapOrder(updated, "admin", "detail");
}

export default {
  confirmOrder,
  confirmOrderByAdmin,
  findOrders,
  getOrderById,
  getOrderByCancelToken,
  markProcessing,
  markShipped,
  markDelivered,
  markCompleted,
  markReturned,
  markRefunded,
  cancelOrder,
  reopenOrder,
  updateOrderContactInfo,
};