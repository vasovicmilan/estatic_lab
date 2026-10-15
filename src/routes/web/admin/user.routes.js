import { Router } from "express";
import * as UserController from "../../../controllers/web/admin/auth/user.controller.js";
import { validateUserStatus, validateUserRole, validateUserId, validateProfileUpdate } from "../../../middlewares/validators/user.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";
import * as UserActivityController from "../../../controllers/web/admin/logs/user-activity.controller.js";
import { requirePermission } from "../../../middlewares/permission.middleware.js";
import { PERMISSION } from "../../../models/role.model.js";

const router = Router();

router.get("/", validateSearch, UserController.listUsers);
router.get("/detalji/:userId", validateUserId, UserController.userDetails);
router.get("/izmena/:userId", validateUserId, UserController.editUserForm);
// the history exposes audit entries, so it needs VIEW_LOGS on top of MANAGE_USERS (mounted in admin.routes.js)
router.get("/:userId/istorija", requirePermission(PERMISSION.VIEW_LOGS), validateUserId, UserActivityController.userHistory);

router.put("/:userId", validateUserId, validateProfileUpdate, UserController.updateUser);
router.put("/:userId/status", validateUserId, validateUserStatus, UserController.updateUserStatus);
router.put("/:userId/rola", validateUserId, validateUserRole, UserController.updateUserRole);
router.put("/:userId/verifikuj", validateUserId, UserController.verifyUser);
router.put("/:userId/anonimizuj", validateUserId, UserController.anonymizeUser);

router.delete("/:userId", validateUserId, UserController.deleteUser);

export default router;