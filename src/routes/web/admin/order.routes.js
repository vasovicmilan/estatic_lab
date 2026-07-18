import { Router } from "express";
import * as OrderController from "../../../controllers/web/admin/order/order.controller.js";
import {
  validateOrderCancel,
  validateOrderReturn,
  validateOrderContactUpdate,
  validateOrderId,
} from "../../../middlewares/validators/order.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";

const router = Router();

router.get("/", validateSearch, OrderController.listOrders);
router.get("/detalji/:orderId", validateOrderId, OrderController.orderDetails);

router.put("/:orderId/obradi", validateOrderId, OrderController.markProcessing);
router.put("/:orderId/posalji", validateOrderId, OrderController.markShipped);
router.put("/:orderId/dostavi", validateOrderId, OrderController.markDelivered);
router.put("/:orderId/zavrsi", validateOrderId, OrderController.markCompleted);
router.put("/:orderId/vrati", validateOrderId, validateOrderReturn, OrderController.markReturned);
router.put("/:orderId/refundiraj", validateOrderId, OrderController.markRefunded);
router.put("/:orderId/otkazi", validateOrderId, validateOrderCancel, OrderController.cancelOrder);
router.put("/:orderId/ponovo-otvori", validateOrderId, OrderController.reopenOrder);
router.put("/:orderId/kontakt", validateOrderId, validateOrderContactUpdate, OrderController.updateOrderContactInfo);

export default router;