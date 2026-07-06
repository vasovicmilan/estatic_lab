import { Router } from "express";
import * as CategoryController from "../../../controllers/web/admin/taxonomy/category.controller.js";
import { validateCategoryCreate, validateCategoryUpdate, validateCategoryId } from "../../../middlewares/validators/category.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";
import { csrfAfterMulter } from "../../../config/csrf.config.js";
import { processUpload } from "../../../config/multer.config.js";

const router = Router();

router.get("/", validateSearch, CategoryController.listCategories);
router.get("/dodavanje", CategoryController.newCategoryForm);
router.get("/detalji/:categoryId", validateCategoryId, CategoryController.categoryDetails);
router.get("/izmena/:categoryId", validateCategoryId, CategoryController.editCategoryForm);

router.post(
  "/dodavanje",
  ...processUpload("categoryImage", "categories"),
  csrfAfterMulter,
  validateCategoryCreate,
  CategoryController.createCategory
);

router.put(
  "/:categoryId",
  validateCategoryId,
  ...processUpload("categoryImage", "categories"),
  csrfAfterMulter,
  validateCategoryUpdate,
  CategoryController.updateCategory
);

router.delete("/:categoryId", validateCategoryId, CategoryController.deleteCategory);

export default router;
