import { Router } from "express";
import * as UserController from "../../../controllers/web/admin/auth/user.controller.js";
import { validateUserStatus, validateUserRole, validateUserId } from "../../../middlewares/validators/user.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";

const router = Router();

router.get("/", validateSearch, UserController.listUsers);
router.get("/detalji/:userId", validateUserId, UserController.userDetails);

router.put("/:userId/status", validateUserId, validateUserStatus, UserController.updateUserStatus);
router.put("/:userId/rola", validateUserId, validateUserRole, UserController.updateUserRole);
router.put("/:userId/verifikuj", validateUserId, UserController.verifyUser);

router.delete("/:userId", validateUserId, UserController.deleteUser);

export default router;
