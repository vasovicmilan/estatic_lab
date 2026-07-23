import { randomUUID } from "crypto";

export function requestIdMiddleware(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}