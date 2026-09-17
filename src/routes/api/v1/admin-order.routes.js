import { Router } from "express";
import * as AdminOrderController from "../../../controllers/api/v1/admin-order.controller.js";
import { validateOrderId, validateOrderCancel, validateOrderReturn, validateOrderContactUpdate, validateManualOrderCreate } from "../../../middlewares/validators/order.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";
import { requirePermission } from "../../../middlewares/permission.middleware.js";

const router = Router();
router.use(apiAuthMiddleware, requirePermission("manage_orders"));

router.get("/orders", AdminOrderController.listOrders);
router.post("/orders/rucno-kreiranje", validateManualOrderCreate, handleApiValidationErrors, AdminOrderController.createManualOrder);
router.get("/orders/:orderId", validateOrderId, handleApiValidationErrors, AdminOrderController.getOrder);
router.put("/orders/:orderId/process", validateOrderId, handleApiValidationErrors, AdminOrderController.markProcessing);
router.put("/orders/:orderId/ship", validateOrderId, handleApiValidationErrors, AdminOrderController.markShipped);
router.put("/orders/:orderId/deliver", validateOrderId, handleApiValidationErrors, AdminOrderController.markDelivered);
router.put("/orders/:orderId/complete", validateOrderId, handleApiValidationErrors, AdminOrderController.markCompleted);
router.put("/orders/:orderId/return", validateOrderId, validateOrderReturn, handleApiValidationErrors, AdminOrderController.markReturned);
router.put("/orders/:orderId/refund", validateOrderId, handleApiValidationErrors, AdminOrderController.markRefunded);
router.put("/orders/:orderId/cancel", validateOrderId, validateOrderCancel, handleApiValidationErrors, AdminOrderController.cancelOrder);
router.put("/orders/:orderId/reopen", validateOrderId, handleApiValidationErrors, AdminOrderController.reopenOrder);
router.put("/orders/:orderId/contact", validateOrderId, validateOrderContactUpdate, handleApiValidationErrors, AdminOrderController.updateOrderContact);

router.get("/temporary-orders", AdminOrderController.listTemporaryOrders);
router.get("/temporary-orders/:orderId", validateOrderId, handleApiValidationErrors, AdminOrderController.getTemporaryOrder);
router.put("/temporary-orders/:orderId/confirm", validateOrderId, handleApiValidationErrors, AdminOrderController.confirmTemporaryOrder);
router.put("/temporary-orders/:orderId/shipping", validateOrderId, handleApiValidationErrors, AdminOrderController.setTemporaryOrderShipping);

export default router;
