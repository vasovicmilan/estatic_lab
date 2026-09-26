import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

// Deliberately NOT mounted under /api/v1 (auth + apiLimiter) or behind globalLimiter -
// an external uptime monitor needs to reach this with no session/API key and without
// risking a 429 during an incident, which is exactly when it's polling hardest. See
// app.js for where this is mounted (early, before the auth-gated routers).
router.get("/health", (req, res) => {
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting -
  // only 1 means the app can actually serve real requests.
  const isConnected = mongoose.connection.readyState === 1;

  if (isConnected) {
    return res.status(200).json({ status: "ok", db: "connected", uptime: process.uptime() });
  }

  return res.status(503).json({ status: "error", db: "disconnected" });
});

export default router;
