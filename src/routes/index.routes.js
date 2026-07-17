import { Router } from "express";
import { apiLimiter } from "../middlewares/rate-limiter.middleware.js";
import webRoutes from "./web/web.routes.js";

const router = Router();

// estatic_lab doesn't have an /api surface yet - apiLimiter is wired here so it's a
// one-line addition ("router.use('/api', apiLimiter, apiRoutes)") once one exists.
router.use("/", webRoutes);

export default router;
