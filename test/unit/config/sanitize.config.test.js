import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";

import {
  setupSanitize,
  sanitizeObject,
  isDangerousKey,
} from "../../../src/config/sanitize.config.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  setupSanitize(app);

  app.post("/echo/:id", (req, res) => {
    res.json({ body: req.body, query: req.query, params: req.params });
  });

  return app;
}

describe("isDangerousKey", () => {
  it("flags keys starting with $", () => {
    assert.equal(isDangerousKey("$gt"), true);
    assert.equal(isDangerousKey("$where"), true);
    assert.equal(isDangerousKey("$ne"), true);
  });

  it("flags keys containing a dot", () => {
    assert.equal(isDangerousKey("a.b"), true);
    assert.equal(isDangerousKey("profile.role"), true);
  });

  it("leaves ordinary keys alone", () => {
    assert.equal(isDangerousKey("email"), false);
    assert.equal(isDangerousKey("name"), false);
    assert.equal(isDangerousKey("id"), false);
  });
});

describe("sanitizeObject", () => {
  it("strips top-level operator keys", () => {
    const obj = { $where: "1==1", name: "ok" };
    sanitizeObject(obj);
    assert.deepEqual(obj, { name: "ok" });
  });

  it("strips operator keys nested under an ordinary field (the classic {email: {$ne: null}} bypass)", () => {
    const obj = { email: { $ne: null } };
    sanitizeObject(obj);
    assert.deepEqual(obj, { email: {} });
  });

  it("strips operator keys nested under a password field too", () => {
    const obj = { password: { $gt: "" } };
    sanitizeObject(obj);
    assert.deepEqual(obj, { password: {} });
  });

  it("strips dotted-path keys", () => {
    const obj = { "profile.role": "admin", profile: "user" };
    sanitizeObject(obj);
    assert.deepEqual(obj, { profile: "user" });
  });

  it("recurses into arrays of objects", () => {
    const obj = { items: [{ $gt: 1 }, { name: "fine" }] };
    sanitizeObject(obj);
    assert.deepEqual(obj, { items: [{}, { name: "fine" }] });
  });

  it("leaves legitimate payloads unchanged", () => {
    const obj = {
      name: "Milan",
      email: "milan@example.com",
      address: { city: "Belgrade", zip: "11000" },
      tags: ["vip", "returning"],
    };
    const before = JSON.parse(JSON.stringify(obj));
    sanitizeObject(obj);
    assert.deepEqual(obj, before);
  });
});

describe("setupSanitize middleware (end-to-end over a real Express 5 app)", () => {
  it("strips operator keys from req.body", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/echo/123")
      .send({ email: { $ne: null }, name: "ok" });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.body, { email: {}, name: "ok" });
  });

  it("strips operator keys from req.query even though Express 5 makes req.query a fresh object on every read", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/echo/123")
      .query({ "$where": "1==1", search: "ok" })
      .send({});

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.query, { search: "ok" });
  });

  it("strips dotted-path keys from req.query", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/echo/123?profile.role=admin")
      .send({});

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.query, {});
  });

  it("strips the classic {email: {$ne: null}} bypass from req.body", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/echo/123")
      .send({ email: { $ne: null }, password: { $gt: "" } });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.body, { email: {}, password: {} });
  });

  it("strips operator keys from req.params-shaped payloads (route param values are always strings, so this guards nested-object params like req.params built from a wildcard/regex route)", async () => {
    const app = buildApp();
    const res = await request(app).post("/echo/123").send({});

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.params, { id: "123" });
  });

  it("leaves a realistic legitimate booking payload untouched end-to-end", async () => {
    const app = buildApp();
    const payload = {
      customerName: "Ana",
      email: "ana@example.com",
      serviceIds: ["svc1", "svc2"],
      notes: "please call before arriving",
    };
    const res = await request(app)
      .post("/echo/123")
      .query({ page: "1", limit: "20" })
      .send(payload);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.body, payload);
    assert.deepEqual(res.body.query, { page: "1", limit: "20" });
  });
});
