import { Router } from "express";
import * as CartController from "../../../controllers/api/v1/cart.controller.js";
import { validateAddToCart, validateUpdateCartItem, validateRemoveCartItem, validateCheckout } from "../../../middlewares/validators/shop.validator.js";
import { handleApiValidationErrors } from "../../../middlewares/api-validation.middleware.js";
import { apiAuthMiddleware } from "../../../middlewares/auth.middleware.js";

const router = Router();

// Every /cart route requires auth (see cart.controller.js's header comment) -
// apiAuthMiddleware applied once for the whole router rather than per-route.
router.use("/cart", apiAuthMiddleware);
router.get("/cart", CartController.getCart);
router.post("/cart/items", validateAddToCart, handleApiValidationErrors, CartController.addItem);
router.put("/cart/items", validateUpdateCartItem, handleApiValidationErrors, CartController.updateItem);
router.delete("/cart/items", validateRemoveCartItem, handleApiValidationErrors, CartController.removeItem);

router.use("/orders/checkout", apiAuthMiddleware);
router.post("/orders/checkout", validateCheckout, handleApiValidationErrors, CartController.checkout);

// Public - reached via the emailed confirmation link, not a logged-in session.
router.get("/orders/:orderId/confirm/:token", CartController.confirmOrder);

export default router;
