import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import {
  validateContactCreate,
  validateContactStatus,
  validateContactId,
} from "../../../src/middlewares/validators/contact.validator.js";

function validContact(overrides = {}) {
  return {
    firstName: "Jovana",
    lastName: "Jovanovic",
    email: "jovana@example.com",
    message: "Zdravo, zanima me vise o vasim uslugama masaze.",
    consent: true,
    ...overrides,
  };
}

describe("contact.validator", () => {
  describe("validateContactCreate", () => {
    it("accepts a fully valid submission", async () => {
      const agent = buildValidatorHarness(validateContactCreate);
      const res = await agent.post("/test").send(validContact());
      assert.equal(res.status, 200);
    });

    it("rejects a missing firstName", async () => {
      const agent = buildValidatorHarness(validateContactCreate);
      const { firstName, ...rest } = validContact();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.firstName);
    });

    it("rejects a missing lastName", async () => {
      const agent = buildValidatorHarness(validateContactCreate);
      const { lastName, ...rest } = validContact();
      const res = await agent.post("/test").send(rest);
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.lastName);
    });

    it("rejects an invalid email", async () => {
      const agent = buildValidatorHarness(validateContactCreate);
      const res = await agent.post("/test").send(validContact({ email: "not-an-email" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.email);
    });

    it("rejects a message shorter than 10 characters", async () => {
      const agent = buildValidatorHarness(validateContactCreate);
      const res = await agent.post("/test").send(validContact({ message: "Kratko" }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.message);
    });

    it("rejects consent that isn't explicitly true", async () => {
      const agent = buildValidatorHarness(validateContactCreate);
      const res = await agent.post("/test").send(validContact({ consent: false }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.consent);
    });

    it("accepts consent sent as the string 'on' (checkbox form submission)", async () => {
      const agent = buildValidatorHarness(validateContactCreate);
      const res = await agent.post("/test").send(validContact({ consent: "on" }));
      assert.equal(res.status, 200);
    });

    it("rejects a topic longer than 150 characters", async () => {
      const agent = buildValidatorHarness(validateContactCreate);
      const res = await agent.post("/test").send(validContact({ topic: "a".repeat(151) }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.topic);
    });

    it("rejects a phone longer than 30 characters when one is given", async () => {
      const agent = buildValidatorHarness(validateContactCreate);
      const res = await agent.post("/test").send(validContact({ phone: "0".repeat(31) }));
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.phone);
    });
  });

  describe("validateContactStatus", () => {
    it("rejects a status outside the allowed enum", async () => {
      const agent = buildValidatorHarness(validateContactStatus);
      const res = await agent.post("/test").send({ status: "urgent" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.status);
    });

    it("accepts a valid status", async () => {
      const agent = buildValidatorHarness(validateContactStatus);
      const res = await agent.post("/test").send({ status: "replied" });
      assert.equal(res.status, 200);
    });
  });

  describe("validateContactId", () => {
    it("rejects a non-mongo-id param", async () => {
      const agent = buildValidatorHarness(validateContactId, { method: "get", path: "/test/:contactId" });
      const res = await agent.get("/test/not-an-id");
      assert.equal(res.status, 400);
    });

    it("accepts a valid mongo id param", async () => {
      const agent = buildValidatorHarness(validateContactId, { method: "get", path: "/test/:contactId" });
      const res = await agent.get(`/test/${new Types.ObjectId().toString()}`);
      assert.equal(res.status, 200);
    });
  });
});