import { Router } from "express";
import * as ProfileController from "../../../controllers/web/admin/profile.controller.js";
import { validateProfileUpdate } from "../../../middlewares/validators/user.validator.js";

const router = Router();

router.get("/", ProfileController.profileForm);
router.put("/", validateProfileUpdate, ProfileController.updateProfile);

export default router;