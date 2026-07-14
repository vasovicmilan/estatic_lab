import { Router } from "express";
import * as RoleController from "../../../controllers/web/admin/auth/role.controller.js";
import { validateRoleCreate, validateRoleUpdate, validateRoleId } from "../../../middlewares/validators/role.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";
import { sanitizeArrayFields } from "../../../middlewares/sanitize-array-fields.middleware.js";

const router = Router();

router.get("/", validateSearch, RoleController.listRoles);
router.get("/dodavanje", RoleController.newRoleForm);
router.get("/detalji/:roleId", validateRoleId, RoleController.roleDetails);
router.get("/izmena/:roleId", validateRoleId, RoleController.editRoleForm);

router.post("/", sanitizeArrayFields("permissions"), validateRoleCreate, RoleController.createRole);

router.put("/:roleId", validateRoleId, sanitizeArrayFields("permissions"), validateRoleUpdate, RoleController.updateRole);

router.delete("/:roleId", validateRoleId, RoleController.deleteRole);

export default router;