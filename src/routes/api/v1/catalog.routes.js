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
// Must be registered BEFORE /team/:slug below - otherwise Express would match
// this path as a slug lookup for a team member literally named "intro".
router.get("/team/intro", CatalogController.getTeamIntro);
router.get("/team/:slug", CatalogController.getTeamMember);

router.get("/blog/posts", requireModule("blog"), CatalogController.listPosts);
// Category-pills-with-counts + tag chips for the blog list/category/tag pages
// - see getBlogFilters's own comment for why this is separate from /blog/posts.
router.get("/blog/filters", requireModule("blog"), CatalogController.getBlogFilters);
router.get("/blog/archive/:type/:slug", requireModule("blog"), CatalogController.getBlogArchive);
router.get("/blog/posts/:slug", requireModule("blog"), CatalogController.getPost);

// NOT module-gated - general marketing content ("our collaborators/sponsors"),
// independent of blog/shop/booking - same reasoning as /saradnici on the web side.
router.get("/business-partners", CatalogController.listBusinessPartners);
router.get("/business-partners/:slug", CatalogController.getBusinessPartner);

// NOT module-gated - static contact/social info (email, phone, address,
// social links), used by the public footer/contact page. Already public
// data (rendered in the EJS footer and site-wide Organization JSON-LD).
router.get("/business-info", CatalogController.getBusinessInfo);

// NOT module-gated - DB-backed marketing/legal CONTENT (see
// site-content.service.js), one endpoint per public page so a page only
// fetches the copy it actually needs. Same public data the old EJS site
// already rendered for anyone who requested those routes; this just makes it
// readable by the SPA too.
router.get("/about", CatalogController.getAboutPage);
router.get("/faq", CatalogController.getFaqPage);
router.get("/privacy-policy", CatalogController.getPrivacyPolicyPage);
router.get("/terms", CatalogController.getTermsPage);
router.get("/partnership-program", requireModule("partners"), CatalogController.getPartnershipPage);
router.get("/home-intro", CatalogController.getHomeIntro);

// SEO (title/description/canonical/OG/JSON-LD) statičkih stranica iz baze - vidi getPageSeo.
router.get("/home", CatalogController.getHomePage);
router.get("/contact-page", CatalogController.getContactPage);
router.get("/list-intro/:page", CatalogController.getListIntro);
router.get("/testimonials", CatalogController.listTestimonials);
router.get("/page-seo/:page", CatalogController.getPageSeo);

export default router;
