import { Router } from "express";
import * as NewsletterController from "../../../controllers/web/admin/marketing/news-letter.controller.js";
import { validateSubscriberId } from "../../../middlewares/validators/newsletter.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";
import campaignRoutes from "./campaign.routes.js";

const router = Router();

// mounted first so /newsletter/kampanje/... never risks being shadowed by a
// broader pattern below it (it isn't currently, since none of those match
// "kampanje" literally, but keeping the more specific mount first is the safer
// habit regardless)
router.use("/kampanje", campaignRoutes);

router.get("/", validateSearch, NewsletterController.listSubscribers);
router.get("/detalji/:subscriberId", validateSubscriberId, NewsletterController.subscriberDetails);

router.delete("/:subscriberId", validateSubscriberId, NewsletterController.deleteSubscriber);

export default router;
