import * as tempOrderService from "../../../../services/temporary-order.service.js";
import * as orderService from "../../../../services/order.service.js";
import {
  prepareTempOrderListData,
  prepareTempOrderDetailsData,
} from "../../../../presenters/admin/order/temporary-order.presenter.js";
import { logError, logInfo } from "../../../../utils/logger.util.js";
import { flashAndRedirect } from "../../../../utils/flash.util.js";

export async function listTemporaryOrders(req, res, next) {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    const result = await tempOrderService.listTemporaryOrders({
      search: search || "",
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
    });

    const viewData = prepareTempOrderListData(result, req.query);

    return res.render("admin/_list", {
      pageTitle: search ? `Pretraga: ${search}` : "Privremene porudžbine",
      pageDescription: "Porudžbine koje čekaju potvrdu kupca putem emaila",
      data: viewData,
    });
  } catch (error) {
    logError("[listTemporaryOrders] Greška pri učitavanju liste privremenih porudžbina", error, { ...req.query, userId: req.session?.user?.id });
    next(error);
  }
}

export async function temporaryOrderDetails(req, res, next) {
  try {
    const { orderId } = req.params;
    const order = await tempOrderService.getTemporaryOrderById(orderId);
    const viewData = prepareTempOrderDetailsData(order);

    return res.render("admin/_details", {
      pageTitle: `Privremena porudžbina - ${order.korisnik.ime}`,
      pageDescription: order.korisnik.email,
      data: viewData,
    });
  } catch (error) {
    logError("[temporaryOrderDetails] Greška pri učitavanju detalja privremene porudžbine", error, { orderId: req.params.orderId, userId: req.session?.user?.id });
    next(error);
  }
}

export async function confirmTemporaryOrderByAdmin(req, res, next) {
  try {
    const { orderId } = req.params;
    const order = await orderService.confirmOrderByAdmin(orderId, req.session?.user?.id);
    logInfo(`[confirmTemporaryOrderByAdmin] Privremena porudžbina #${orderId} potvrđena od strane admina`, { orderId, adminId: req.session?.user?.id });

    return flashAndRedirect(req, res, "success", "Porudžbina je potvrđena", `/admin/porudzbine/detalji/${order.id}`);
  } catch (error) {
    logError("[confirmTemporaryOrderByAdmin] Greška pri potvrđivanju porudžbine od strane admina", error, { orderId: req.params.orderId, userId: req.session?.user?.id });
    if (error.statusCode) {
      return flashAndRedirect(req, res, "error", error.message, `/admin/privremene-porudzbine/detalji/${req.params.orderId}`);
    }
    next(error);
  }
}

export default { listTemporaryOrders, temporaryOrderDetails, confirmTemporaryOrderByAdmin };