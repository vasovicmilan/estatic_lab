import { Router } from "express";
import * as TemporaryOrderController from "../../../controllers/web/admin/order/temporary-order.controller.js";
import { validateOrderId } from "../../../middlewares/validators/order.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";

const router = Router();

router.get("/", validateSearch, TemporaryOrderController.listTemporaryOrders);
router.get("/detalji/:orderId", validateOrderId, TemporaryOrderController.temporaryOrderDetails);
router.put("/:orderId/potvrdi", validateOrderId, TemporaryOrderController.confirmTemporaryOrderByAdmin);

export default router;