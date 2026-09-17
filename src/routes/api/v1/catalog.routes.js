import { Router } from "express";
import * as CatalogController from "../../../controllers/api/v1/catalog.controller.js";

const router = Router();

router.get("/services", CatalogController.listServices);
router.get("/services/:slug", CatalogController.getService);

router.get("/packages", CatalogController.listPackages);
router.get("/packages/:slug", CatalogController.getPackage);

router.get("/products", CatalogController.listProducts);
router.get("/products/:slug", CatalogController.getProduct);

router.get("/team", CatalogController.listTeam);
router.get("/team/:slug", CatalogController.getTeamMember);

router.get("/blog/posts", CatalogController.listPosts);
router.get("/blog/posts/:slug", CatalogController.getPost);

router.get("/business-partners", CatalogController.listBusinessPartners);
router.get("/business-partners/:slug", CatalogController.getBusinessPartner);

export default router;
