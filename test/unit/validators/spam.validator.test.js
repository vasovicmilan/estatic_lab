import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import { validateHoneypot } from "../../../src/middlewares/validators/spam.validator.js";

describe("spam.validator", () => {
  describe("validateHoneypot", () => {
    it("accepts a request with no nickname field at all", async () => {
      const agent = buildValidatorHarness(validateHoneypot);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 200);
    });

    it("accepts a request with an empty nickname", async () => {
      const agent = buildValidatorHarness(validateHoneypot);
      const res = await agent.post("/test").send({ nickname: "" });
      assert.equal(res.status, 200);
    });

    it("rejects a request where the honeypot field was filled in (bot behavior)", async () => {
      const agent = buildValidatorHarness(validateHoneypot);
      const res = await agent.post("/test").send({ nickname: "im-a-bot" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.nickname);
    });
  });
});