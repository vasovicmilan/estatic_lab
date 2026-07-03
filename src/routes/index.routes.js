import { Router } from "express";
import { apiLimiter } from "../middlewares/rate-limiter.middleware.js";
import webRoutes from "./web/web.routes.js";

const router = Router();

router.use("/", webRoutes);

export default router;