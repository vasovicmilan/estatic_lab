import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import { validateSearch } from "../../../src/middlewares/validators/search.validator.js";

describe("search.validator", () => {
  describe("validateSearch", () => {
    it("accepts an empty query", async () => {
      const agent = buildValidatorHarness(validateSearch, { method: "get" });
      const res = await agent.get("/test");
      assert.equal(res.status, 200);
    });

    it("rejects a search term longer than 100 characters", async () => {
      const agent = buildValidatorHarness(validateSearch, { method: "get" });
      const res = await agent.get("/test").query({ search: "a".repeat(101) });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.search);
    });

    it("rejects a non-positive page number", async () => {
      const agent = buildValidatorHarness(validateSearch, { method: "get" });
      const res = await agent.get("/test").query({ page: 0 });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.page);
    });

    it("rejects a limit above 100", async () => {
      const agent = buildValidatorHarness(validateSearch, { method: "get" });
      const res = await agent.get("/test").query({ limit: 101 });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.limit);
    });

    it("accepts valid search, page, and limit values", async () => {
      const agent = buildValidatorHarness(validateSearch, { method: "get" });
      const res = await agent.get("/test").query({ search: "masaza", page: 2, limit: 20 });
      assert.equal(res.status, 200);
    });
  });
});