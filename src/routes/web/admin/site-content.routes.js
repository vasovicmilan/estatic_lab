import { Router } from "express";
import * as SiteContentController from "../../../controllers/web/admin/marketing/site-content.controller.js";

const router = Router();

// Web admin za tekstove sajta (SiteContent singleton) - isti podaci koji su
// ranije mogli da se menjaju samo preko API-ja (api/v1/admin-ops.routes.js
// -> /site-content/*). Slug-ovi (:section) su isti kao u API putanjama:
// o-nama, faq, politika-privatnosti, uslovi-koriscenja, partnerski-program,
// pocetna-uvod, zasto-mi, tim-uvod.
//
// Složena polja (sekcije, ponavljajuće liste) klijentski graditelj
// (public/js/admin-site-content.js) šalje kao JSON string u skrivenom
// input-u; parsira ih kontroler (buildSectionPayload).
router.get("/", SiteContentController.siteContentIndex);
router.get("/:section", SiteContentController.siteContentForm);
router.put("/:section", SiteContentController.updateSiteContent);

export default router;
