import { Router } from "express";
import * as NewsletterController from "../../../controllers/web/admin/marketing/news-letter.controller.js";
import { validateSubscriberId } from "../../../middlewares/validators/newsletter.validator.js";
import { validateSearch } from "../../../middlewares/validators/search.validator.js";

const router = Router();

router.get("/", validateSearch, NewsletterController.listSubscribers);
router.get("/detalji/:subscriberId", validateSubscriberId, NewsletterController.subscriberDetails);

router.delete("/:subscriberId", validateSubscriberId, NewsletterController.deleteSubscriber);

export default router;
