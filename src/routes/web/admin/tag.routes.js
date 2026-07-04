import { Router } from "express";
import * as TagController from "../../../controllers/web/admin/taxonomy/tag.controller.js";
import { validateTagCreate, validateTagUpdate, validateTagId } from "../../../middlewares/validators/tag.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";

const router = Router();

router.get("/", validateSearch, TagController.listTags);
router.get("/dodavanje", TagController.newTagForm);
router.get("/detalji/:tagId", validateTagId, TagController.tagDetails);
router.get("/izmena/:tagId", validateTagId, TagController.editTagForm);

router.post("/", validateTagCreate, TagController.createTag);

router.put("/:tagId", validateTagId, validateTagUpdate, TagController.updateTag);

router.delete("/:tagId", validateTagId, TagController.deleteTag);

export default router;
