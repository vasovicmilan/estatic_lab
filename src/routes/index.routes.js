import { Router } from "express";
import { apiLimiter } from "../middlewares/rate-limiter.middleware.js";
import webRoutes from "./web/web.routes.js";
import apiV1Routes from "./api/v1/index.routes.js";

const router = Router();

router.use("/api/v1", apiLimiter, apiV1Routes);
router.use("/", webRoutes);

export default router;
