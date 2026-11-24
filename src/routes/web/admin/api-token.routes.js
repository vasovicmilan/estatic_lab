import { Router } from "express";
import * as ApiTokenController from "../../../controllers/web/admin/marketing/api-token.controller.js";
import { mongoIdParamValidator } from "../../../middlewares/validators/helpers/common.validator.js";

const router = Router();
const validateTokenId = mongoIdParamValidator("tokenId", "tokena");

router.get("/", ApiTokenController.listTokens);
router.post("/", ApiTokenController.createToken);
router.post("/pauza", ApiTokenController.setPause);
router.post("/:tokenId/opozovi", validateTokenId, ApiTokenController.revokeToken);

export default router;
