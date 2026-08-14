import * as orderService from "../../../../services/order.service.js";
import { prepareOrderListData, prepareOrderDetailsData } from "../../../../presenters/admin/order/order.presenter.js";
import { logError, logWarn, logInfo } from "../../../../utils/logger.util.js";
import auditLogService from "../../../../services/audit-log.service.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

export async function listOrders(req, res, next) {
  try {
    const { search, status, dateFrom, dateTo, page = 1, limit = 10 } = req.query;

    const result = await orderService.findOrders({
      search: search || "",
      role: "admin",
      filters: {
        status: status || undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      },
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareOrderListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Porudžbine",
      pageDescription: "Pregled svih porudžbina",
      data: viewData,
    });
  } catch (error) {
    logError("[listOrders] Greška pri učitavanju liste porudžbina", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function orderDetails(req, res, next) {
  try {
    const { orderId } = req.params;
    const order = await orderService.getOrderById(orderId, req.session?.user?.id, "admin");
    const viewData = prepareOrderDetailsData(order);

    return res.render("admin/_details", {
      pageTitle: `Porudžbina - ${order.korisnik.ime}`,
      pageDescription: order.ukupnaCena,
      data: viewData,
    });
  } catch (error) {
    logError("[orderDetails] Greška pri učitavanju detalja porudžbine", error, { orderId: req.params.orderId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function markProcessing(req, res, next) {
  try {
    const { orderId } = req.params;
    await orderService.markProcessing(orderId, req.session?.user?.id);
    logInfo(`[markProcessing] Porudžbina #${orderId} označena kao u obradi`, { orderId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "ORDER_STATUS_PROCESSING",
      entity: { type: "Order", id: orderId },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Porudžbina je označena kao u obradi", `/admin/porudzbine/detalji/${orderId}`);
  } catch (error) {
    logError("[markProcessing] Greška pri promeni statusa porudžbine", error, { orderId: req.params.orderId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/porudzbine/detalji/${req.params.orderId}`);
    }
    next(error);
  }
}

export async function markShipped(req, res, next) {
  try {
    const { orderId } = req.params;
    await orderService.markShipped(orderId, req.session?.user?.id);
    logInfo(`[markShipped] Porudžbina #${orderId} označena kao poslata`, { orderId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "ORDER_STATUS_SHIPPED",
      entity: { type: "Order", id: orderId },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Porudžbina je označena kao poslata", `/admin/porudzbine/detalji/${orderId}`);
  } catch (error) {
    logError("[markShipped] Greška pri promeni statusa porudžbine", error, { orderId: req.params.orderId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/porudzbine/detalji/${req.params.orderId}`);
    }
    next(error);
  }
}

export async function markDelivered(req, res, next) {
  try {
    const { orderId } = req.params;
    await orderService.markDelivered(orderId, req.session?.user?.id);
    logInfo(`[markDelivered] Porudžbina #${orderId} označena kao dostavljena`, { orderId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "ORDER_STATUS_DELIVERED",
      entity: { type: "Order", id: orderId },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Porudžbina je označena kao dostavljena", `/admin/porudzbine/detalji/${orderId}`);
  } catch (error) {
    logError("[markDelivered] Greška pri promeni statusa porudžbine", error, { orderId: req.params.orderId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/porudzbine/detalji/${req.params.orderId}`);
    }
    next(error);
  }
}

export async function markCompleted(req, res, next) {
  try {
    const { orderId } = req.params;
    await orderService.markCompleted(orderId, req.session?.user?.id);
    logInfo(`[markCompleted] Porudžbina #${orderId} označena kao završena`, { orderId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "ORDER_STATUS_COMPLETED",
      entity: { type: "Order", id: orderId },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Porudžbina je označena kao završena", `/admin/porudzbine/detalji/${orderId}`);
  } catch (error) {
    logError("[markCompleted] Greška pri promeni statusa porudžbine", error, { orderId: req.params.orderId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/porudzbine/detalji/${req.params.orderId}`);
    }
    next(error);
  }
}

export async function markReturned(req, res, next) {
  try {
    const { orderId } = req.params;

    if (req.validationErrors) {
      logWarn(`[markReturned] Validacione greške za orderId=${orderId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), `/admin/porudzbine/detalji/${orderId}`);
    }

    await orderService.markReturned(orderId, req.body.reason, req.session?.user?.id);
    logInfo(`[markReturned] Porudžbina #${orderId} označena kao vraćena`, { orderId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "ORDER_STATUS_RETURNED",
      entity: { type: "Order", id: orderId },
      changes: { reason: { old: null, new: req.body.reason || null } },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Porudžbina je označena kao vraćena", `/admin/porudzbine/detalji/${orderId}`);
  } catch (error) {
    logError("[markReturned] Greška pri promeni statusa porudžbine", error, { orderId: req.params.orderId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/porudzbine/detalji/${req.params.orderId}`);
    }
    next(error);
  }
}

export async function markRefunded(req, res, next) {
  try {
    const { orderId } = req.params;
    await orderService.markRefunded(orderId, req.session?.user?.id);
    logInfo(`[markRefunded] Porudžbina #${orderId} označena kao refundirana`, { orderId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "ORDER_STATUS_REFUNDED",
      entity: { type: "Order", id: orderId },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Porudžbina je označena kao refundirana", `/admin/porudzbine/detalji/${orderId}`);
  } catch (error) {
    logError("[markRefunded] Greška pri promeni statusa porudžbine", error, { orderId: req.params.orderId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/porudzbine/detalji/${req.params.orderId}`);
    }
    next(error);
  }
}

export async function cancelOrder(req, res, next) {
  try {
    const { orderId } = req.params;

    if (req.validationErrors) {
      logWarn(`[cancelOrder] Validacione greške za orderId=${orderId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), `/admin/porudzbine/detalji/${orderId}`);
    }

    await orderService.cancelOrder(orderId, req.body.reason, req.session?.user?.id, "admin");
    logInfo(`[cancelOrder] Porudžbina #${orderId} otkazana od strane admina`, { orderId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "ORDER_CANCELLED",
      entity: { type: "Order", id: orderId },
      changes: { reason: { old: null, new: req.body.reason || null } },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Porudžbina je otkazana", `/admin/porudzbine/detalji/${orderId}`);
  } catch (error) {
    logError("[cancelOrder] Greška pri otkazivanju porudžbine", error, { orderId: req.params.orderId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/porudzbine/detalji/${req.params.orderId}`);
    }
    next(error);
  }
}

export async function reopenOrder(req, res, next) {
  try {
    const { orderId } = req.params;
    await orderService.reopenOrder(orderId, req.session?.user?.id);
    logInfo(`[reopenOrder] Porudžbina #${orderId} ponovo otvorena`, { orderId, adminId: req.session?.user?.id });
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "ORDER_REOPENED",
      entity: { type: "Order", id: orderId },
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Porudžbina je ponovo otvorena", `/admin/porudzbine/detalji/${orderId}`);
  } catch (error) {
    logError("[reopenOrder] Greška pri ponovnom otvaranju porudžbine", error, { orderId: req.params.orderId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/porudzbine/detalji/${req.params.orderId}`);
    }
    next(error);
  }
}

export async function updateOrderContactInfo(req, res, next) {
  try {
    const { orderId } = req.params;

    if (req.validationErrors) {
      logWarn(`[updateOrderContactInfo] Validacione greške za orderId=${orderId}`, { validationErrors: req.validationErrors, userId: req.session?.user?.id });
      return flashAndRedirect(req, res, "error", Object.values(req.validationErrors).join(", "), `/admin/porudzbine/detalji/${orderId}`);
    }

    const existing = await orderService.getOrderById(orderId, req.session?.user?.id, "admin");
    await orderService.updateOrderContactInfo(orderId, { phone: req.body.phone, address: req.body.address });
    logInfo(`[updateOrderContactInfo] Kontakt podaci porudžbine #${orderId} ažurirani`, { orderId, adminId: req.session?.user?.id });
    const afterUpdate = await orderService.getOrderById(orderId, req.session?.user?.id, "admin");
    // telefon/adresa su ugnezdjena polja (korisnik.telefon, adresa) u mapiranom obliku,
    // pa se prvo "izravnjuju" u plitke objekte da bi computeChanges (koji poredi samo
    // top-level kljuceve) mogao ispravno da ih uporedi.
    const changes = auditLogService.computeChanges(
      { telefon: existing?.korisnik?.telefon, adresa: existing?.adresa },
      { telefon: afterUpdate?.korisnik?.telefon, adresa: afterUpdate?.adresa },
      ["telefon", "adresa"]
    );
    await auditLogService.recordAuditLog({
      actor: req.session?.user,
      action: "ORDER_CONTACT_INFO_UPDATED",
      entity: { type: "Order", id: orderId },
      changes,
      req,
      success: true,
    });
    return flashAndRedirect(req, res, "success", "Kontakt podaci su ažurirani", `/admin/porudzbine/detalji/${orderId}`);
  } catch (error) {
    logError("[updateOrderContactInfo] Greška pri ažuriranju kontakt podataka", error, { orderId: req.params.orderId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/porudzbine/detalji/${req.params.orderId}`);
    }
    next(error);
  }
}

export default {
  listOrders,
  orderDetails,
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