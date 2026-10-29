import { Router } from "express";
import * as TutorialController from "../../controllers/web/public/tutorial.controller.js";

const router = Router();

// req.user is already set (or absent for a guest) by optionalWebAuth in web.routes.js -
// access to each video is decided per file inside the controller, from the manifest's audience
router.get("/", TutorialController.tutorialsPage);
router.get("/video/:id/:device/:lang", TutorialController.tutorialVideo);
router.get("/poster/:id/:device", TutorialController.tutorialPoster);

export default router;
