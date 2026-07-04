import { Router } from "express";
import * as ContactController from "../../../controllers/web/admin/marketing/contact.controller.js";
import { validateContactStatus, validateContactId } from "../../../middlewares/validators/contact.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";

const router = Router();

router.get("/", validateSearch, ContactController.listContacts);
router.get("/detalji/:contactId", validateContactId, ContactController.contactDetails);

router.put("/:contactId/status", validateContactId, validateContactStatus, ContactController.updateContactStatus);

export default router;
