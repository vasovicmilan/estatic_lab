import { Router } from "express";
import * as ShopController from "../../controllers/web/public/shop.controller.js";
import {
  validateAddToCart,
  validateUpdateCartItem,
  validateRemoveCartItem,
  validateCheckout,
} from "../../middlewares/validators/shop.validator.js";

const router = Router();

router.get("/", ShopController.cartPage);
router.post("/dodaj", validateAddToCart, ShopController.addToCart);
router.post("/azuriraj", validateUpdateCartItem, ShopController.updateCartItem);
router.post("/ukloni", validateRemoveCartItem, ShopController.removeCartItem);

router.get("/naplata", ShopController.checkoutStep);
router.post("/naplata", validateCheckout, ShopController.submitCheckout);

router.get("/potvrdite-porudzbinu", ShopController.checkoutPending);
router.get("/potvrda/:orderId/:token", ShopController.confirmOrder);

export default router;