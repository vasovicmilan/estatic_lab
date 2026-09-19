import { Router } from "express";
import * as CatalogController from "../../../controllers/api/v1/catalog.controller.js";
import { requireModule } from "../../../middlewares/feature.middleware.js";

const router = Router();

router.get("/services", requireModule("booking"), CatalogController.listServices);
router.get("/services/:slug", requireModule("booking"), CatalogController.getService);

// Packages relate exclusively to services (see docs/*/16) - same "booking" gate.
router.get("/packages", requireModule("booking"), CatalogController.listPackages);
router.get("/packages/:slug", requireModule("booking"), CatalogController.getPackage);

router.get("/products", requireModule("shop"), CatalogController.listProducts);
router.get("/products/:slug", requireModule("shop"), CatalogController.getProduct);

// NOT module-gated - "team" here means Expert, the public showcase profile
// that's deliberately independent of Employee/booking (see expert.model.js's
// own comment: works with zero login accounts behind it).
router.get("/team", CatalogController.listTeam);
router.get("/team/:slug", CatalogController.getTeamMember);

router.get("/blog/posts", requireModule("blog"), CatalogController.listPosts);
router.get("/blog/posts/:slug", requireModule("blog"), CatalogController.getPost);

// NOT module-gated - general marketing content ("our collaborators/sponsors"),
// independent of blog/shop/booking - same reasoning as /saradnici on the web side.
router.get("/business-partners", CatalogController.listBusinessPartners);
router.get("/business-partners/:slug", CatalogController.getBusinessPartner);

export default router;
