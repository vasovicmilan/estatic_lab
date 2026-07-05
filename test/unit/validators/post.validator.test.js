import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import {
  validatePostCreate,
  validatePostUpdate,
  validatePostStatus,
  validatePostSeo,
  validatePostId,
} from "../../../src/middlewares/validators/post.validator.js";

function validPost(overrides = {}) {
  return { title: "Kako Da Se Opustite", excerpt: "Kratak opis posta", ...overrides };
}

describe("post.validator", () => {
  describe("validatePostCreate", () => {
    it("accepts a minimal valid post", async () => {
      const agent = buildValidatorHarness(validatePostCreate);
      const res = await agent.post("/test").send(validPost());
      assert.equal(res.status, 200);
    });

    it("rejects a missing title", async () => {
      const agent = buildValidatorHarness(validatePostCreate);
      const { title, ...rest } = validPost();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.title);
    });

    it("rejects a missing excerpt", async () => {
      const agent = buildValidatorHarness(validatePostCreate);
      const { excerpt, ...rest } = validPost();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.excerpt);
    });

    it("rejects an excerpt longer than 300 characters", async () => {
      const agent = buildValidatorHarness(validatePostCreate);
      const res = await agent.post("/test").send(validPost({ excerpt: "a".repeat(301) }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.excerpt);
    });

    it("rejects malformed content", async () => {
      const agent = buildValidatorHarness(validatePostCreate);
      const res = await agent.post("/test").send(validPost({ content: "not-json" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.content);
    });

    it("accepts content as a JSON string", async () => {
      const agent = buildValidatorHarness(validatePostCreate);
      const res = await agent.post("/test").send(validPost({ content: JSON.stringify([{ type: "paragraph", text: "..." }]) }));
      assert.equal(res.status, 200);
    });

    it("rejects a non-mongo-id author", async () => {
      const agent = buildValidatorHarness(validatePostCreate);
      const res = await agent.post("/test").send(validPost({ author: "not-an-id" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.author);
    });

    it("rejects a status outside the allowed enum", async () => {
      const agent = buildValidatorHarness(validatePostCreate);
      const res = await agent.post("/test").send(validPost({ status: "in-progress" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.status);
    });
  });

  describe("validatePostUpdate", () => {
    it("accepts an empty body", async () => {
      const agent = buildValidatorHarness(validatePostUpdate);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 200);
    });
  });

  describe("validatePostStatus", () => {
    it("rejects a missing status", async () => {
      const agent = buildValidatorHarness(validatePostStatus);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.status);
    });

    it("accepts a valid status", async () => {
      const agent = buildValidatorHarness(validatePostStatus);
      const res = await agent.post("/test").send({ status: "published" });
      assert.equal(res.status, 200);
    });
  });

  describe("validatePostSeo", () => {
    it("rejects a seoTitle longer than 70 characters", async () => {
      const agent = buildValidatorHarness(validatePostSeo);
      const res = await agent.post("/test").send({ seoTitle: "a".repeat(71) });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.seoTitle);
    });

    it("rejects a seoDescription longer than 160 characters", async () => {
      const agent = buildValidatorHarness(validatePostSeo);
      const res = await agent.post("/test").send({ seoDescription: "a".repeat(161) });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.seoDescription);
    });

    it("accepts valid SEO fields", async () => {
      const agent = buildValidatorHarness(validatePostSeo);
      const res = await agent.post("/test").send({ seoTitle: "Naslov", seoDescription: "Opis" });
      assert.equal(res.status, 200);
    });
  });

  describe("validatePostId", () => {
    it("rejects a non-mongo-id param", async () => {
      const agent = buildValidatorHarness(validatePostId, { method: "get", path: "/test/:postId" });
      const res = await agent.get("/test/not-an-id");
      assert.equal(res.status, 400);
    });

    it("accepts a valid mongo id param", async () => {
      const agent = buildValidatorHarness(validatePostId, { method: "get", path: "/test/:postId" });
      const res = await agent.get(`/test/${new Types.ObjectId().toString()}`);
      assert.equal(res.status, 200);
    });
  });
});