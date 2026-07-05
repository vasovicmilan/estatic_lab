import express from "express";
import request from "supertest";

export function buildValidatorHarness(validators, { method = "post", path = "/test" } = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app[method](path, validators, (req, res) => {
    res.status(req.validationErrors ? 400 : 200).json({ errors: req.validationErrors || null });
  });

  return request(app);
}

export default { buildValidatorHarness };