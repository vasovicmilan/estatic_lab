import { Router } from "express";
import * as CouponController from "../../../controllers/web/admin/marketing/coupon.controller.js";
import { validateCouponCreate, validateCouponUpdate, validateCouponId } from "../../../middlewares/validators/coupon.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";

const router = Router();

router.get("/", validateSearch, CouponController.listCoupons);
router.get("/dodavanje", CouponController.newCouponForm);
router.get("/detalji/:couponId", validateCouponId, CouponController.couponDetails);
router.get("/izmena/:couponId", validateCouponId, CouponController.editCouponForm);

router.post("/", validateCouponCreate, CouponController.createCoupon);

router.put("/:couponId", validateCouponId, validateCouponUpdate, CouponController.updateCoupon);

router.delete("/:couponId", validateCouponId, CouponController.deleteCoupon);

export default router;