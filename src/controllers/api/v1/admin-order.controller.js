import orderService from "../../../services/order.service.js";
import * as tempOrderService from "../../../services/temporary-order.service.js";
import auditLogService from "../../../services/audit-log.service.js";
import { logError, logInfo } from "../../../utils/logger.util.js";
import { getStartOfDayInZone, nextDayStartInZone } from "../../../utils/date.time.util.js";
import { resolvePage, resolveLimit, pickPaginationMeta } from "../../../utils/pagination.util.js";
import { buildAuditActor } from "../../../utils/audit-actor.util.js";
import { createEntityActionFactory } from "../../../utils/admin-entity-action.util.js";

// Mirrors controllers/web/admin/order/{order,manual-order,temporary-order}
// .controller.js - same services, same audit log entries.

export async function listOrders(req, res, next) {
  try {
    const { search, status, dateFrom, dateTo, page = 1, limit = 10 } = req.query;
    const result = await orderService.findOrders({
      search: search || "",
      role: "admin",
      filters: {
        status: status || undefined,
        dateFrom: dateFrom ? getStartOfDayInZone(dateFrom) : undefined,
        dateTo: dateTo ? nextDayStartInZone(dateTo) : undefined,
      },
      page: resolvePage(page),
      limit: resolveLimit(limit),
    });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listOrders] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getOrder(req, res, next) {
  try {
    const order = await orderService.getOrderById(req.params.orderId, req.user.id, "admin");
    return res.json({ success: true, data: order });
  } catch (error) {
    logError("[api/admin/getOrder] Greška", error, { orderId: req.params.orderId });
    next(error);
  }
}

const orderAction = createEntityActionFactory({
  logPrefix: "api/admin",
  entityType: "Order",
  entityLabel: "Porudžbina",
  idParam: "orderId",
});

export const markProcessing = orderAction("markProcessing", "ORDER_STATUS_PROCESSING", (id, req) => orderService.markProcessing(id, req.user.id), "Porudžbina je u obradi.");
export const markShipped = orderAction("markShipped", "ORDER_STATUS_SHIPPED", (id, req) => orderService.markShipped(id, req.user.id), "Porudžbina je poslata.");
export const markDelivered = orderAction("markDelivered", "ORDER_STATUS_DELIVERED", (id, req) => orderService.markDelivered(id, req.user.id), "Porudžbina je dostavljena.");
export const markCompleted = orderAction("markCompleted", "ORDER_STATUS_COMPLETED", (id, req) => orderService.markCompleted(id, req.user.id), "Porudžbina je završena.");
export const markRefunded = orderAction("markRefunded", "ORDER_STATUS_REFUNDED", (id, req) => orderService.markRefunded(id, req.user.id), "Porudžbina je refundirana.");
export const reopenOrder = orderAction("reopenOrder", "ORDER_REOPENED", (id, req) => orderService.reopenOrder(id, req.user.id), "Porudžbina je ponovo otvorena.");
export const markReturned = orderAction("markReturned", "ORDER_STATUS_RETURNED", (id, req) => orderService.markReturned(id, req.body.reason, req.user.id), "Porudžbina je vraćena.");
export const cancelOrder = orderAction("cancelOrder", "ORDER_CANCELLED", (id, req) => orderService.cancelOrder(id, req.body.reason, req.user.id, "admin"), "Porudžbina je otkazana.");

export async function updateOrderContact(req, res, next) {
  try {
    const { orderId } = req.params;
    await orderService.updateOrderContactInfo(orderId, { phone: req.body.phone, address: req.body.address });
    logInfo(`[api/admin/updateOrderContact] Kontakt podaci porudžbine #${orderId} ažurirani`, { orderId, adminId: req.user.id });
    await auditLogService.recordAuditLog({ ...buildAuditActor(req), action: "ORDER_CONTACT_INFO_UPDATED", entity: { type: "Order", id: orderId } });
    return res.json({ success: true, data: { message: "Kontakt podaci su ažurirani." } });
  } catch (error) {
    logError("[api/admin/updateOrderContact] Greška", error, { orderId: req.params.orderId });
    next(error);
  }
}

export async function createManualOrder(req, res, next) {
  const { productId, variantId, quantity, existingUserId, firstName, lastName, email, phone, address, shipping, note, priceOverride } = req.body;

  try {
    const order = await orderService.createManualOrder(
      {
        items: [{ productId, variantId, quantity: parseInt(quantity, 10), priceOverride: priceOverride != null ? parseFloat(priceOverride) : null }],
        existingUserId: existingUserId || null,
        contact: { firstName, lastName, email },
        phone,
        address,
        shipping: shipping ? parseFloat(shipping) : 0,
        note,
      },
      { actorId: req.user.id, actorRole: req.user.roleName || "admin" }
    );

    logInfo("[api/admin/createManualOrder] Porudžbina ručno kreirana", { orderId: order.id, adminId: req.user.id });
    await auditLogService.recordAuditLog({
      ...buildAuditActor(req),
      action: "ORDER_MANUALLY_CREATED",
      entity: { type: "Order", id: order.id },
      changes: { productId: { old: null, new: productId }, variantId: { old: null, new: variantId } },
    });

    return res.status(201).json({ success: true, data: order });
  } catch (error) {
    logError("[api/admin/createManualOrder] Greška", error, { body: req.body });
    next(error);
  }
}

// ---- Temporary orders (awaiting the customer's own email confirmation) ----

export async function listTemporaryOrders(req, res, next) {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const result = await tempOrderService.listTemporaryOrders({ search: search || "", page: resolvePage(page), limit: resolveLimit(limit) });
    return res.json({ success: true, data: result.data, meta: pickPaginationMeta(result) });
  } catch (error) {
    logError("[api/admin/listTemporaryOrders] Greška", error, { query: req.query });
    next(error);
  }
}

export async function getTemporaryOrder(req, res, next) {
  try {
    const order = await tempOrderService.getTemporaryOrderById(req.params.orderId);
    return res.json({ success: true, data: order });
  } catch (error) {
    logError("[api/admin/getTemporaryOrder] Greška", error, { orderId: req.params.orderId });
    next(error);
  }
}

export async function confirmTemporaryOrder(req, res, next) {
  try {
    const { orderId } = req.params;
    const order = await orderService.confirmOrderByAdmin(orderId, req.user.id);
    logInfo(`[api/admin/confirmTemporaryOrder] Privremena porudžbina #${orderId} potvrđena od strane admina`, { orderId, adminId: req.user.id });
    return res.json({ success: true, data: order });
  } catch (error) {
    logError("[api/admin/confirmTemporaryOrder] Greška", error, { orderId: req.params.orderId });
    next(error);
  }
}

// Sets the real shipping cost on a freight-quote temporary order (see
// product.model.js's shippingClass) - unblocks the customer's own confirmation
// link once saved (order.service.js's confirmOrder).
export async function setTemporaryOrderShipping(req, res, next) {
  try {
    const { orderId } = req.params;
    const shippingAmount = Number(req.body.shippingAmount);
    await tempOrderService.updateTemporaryOrderShipping(orderId, shippingAmount, req.user.id);
    logInfo(`[api/admin/setTemporaryOrderShipping] Cena dostave postavljena za #${orderId}`, { orderId, shippingAmount, adminId: req.user.id });
    return res.json({ success: true, data: { message: "Cena dostave je sačuvana." } });
  } catch (error) {
    logError("[api/admin/setTemporaryOrderShipping] Greška", error, { orderId: req.params.orderId });
    next(error);
  }
}

export default {
  listOrders, getOrder,
  markProcessing, markShipped, markDelivered, markCompleted, markReturned, markRefunded, cancelOrder, reopenOrder,
  updateOrderContact, createManualOrder,
  listTemporaryOrders, getTemporaryOrder, confirmTemporaryOrder, setTemporaryOrderShipping,
};
