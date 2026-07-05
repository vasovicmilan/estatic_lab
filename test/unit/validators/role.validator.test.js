import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildValidatorHarness } from "../../helpers/validator-harness.js";
import {
  validateRoleCreate,
  validateRoleUpdate,
  validateRoleId,
} from "../../../src/middlewares/validators/role.validator.js";

describe("role.validator", () => {
  describe("validateRoleCreate", () => {
    it("accepts a valid role name", async () => {
      const agent = buildValidatorHarness(validateRoleCreate);
      const res = await agent.post("/test").send({ name: "employee" });
      assert.equal(res.status, 200);
    });

    it("rejects a missing name", async () => {
      const agent = buildValidatorHarness(validateRoleCreate);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.name);
    });

    it("rejects a name outside the closed role set", async () => {
      const agent = buildValidatorHarness(validateRoleCreate);
      const res = await agent.post("/test").send({ name: "superadmin" });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.name);
    });

    it("rejects a description longer than 300 characters", async () => {
      const agent = buildValidatorHarness(validateRoleCreate);
      const res = await agent.post("/test").send({ name: "user", description: "a".repeat(301) });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.description);
    });

    it("rejects a permission outside the allowed set", async () => {
      const agent = buildValidatorHarness(validateRoleCreate);
      const res = await agent.post("/test").send({ name: "user", permissions: ["delete_everything"] });
      assert.equal(res.status, 400);
    });

    it("accepts a valid list of permissions", async () => {
      const agent = buildValidatorHarness(validateRoleCreate);
      const res = await agent.post("/test").send({ name: "admin", permissions: ["manage_users", "view_dashboard"] });
      assert.equal(res.status, 200);
    });

    it("rejects a negative priority", async () => {
      const agent = buildValidatorHarness(validateRoleCreate);
      const res = await agent.post("/test").send({ name: "user", priority: -1 });
      assert.equal(res.status, 400);
      assert.ok(res.body.errors.priority);
    });
  });

  describe("validateRoleUpdate", () => {
    it("accepts an empty body", async () => {
      const agent = buildValidatorHarness(validateRoleUpdate);
      const res = await agent.post("/test").send({});
      assert.equal(res.status, 200);
    });

    it("rejects an invalid name when one is given", async () => {
      const agent = buildValidatorHarness(validateRoleUpdate);
      const res = await agent.post("/test").send({ name: "superadmin" });
      assert.equal(res.status, 400);
    });
  });

  describe("validateRoleId", () => {
    it("rejects a non-mongo-id param", async () => {
      const agent = buildValidatorHarness(validateRoleId, { method: "get", path: "/test/:roleId" });
      const res = await agent.get("/test/not-an-id");
      assert.equal(res.status, 400);
    });

    it("accepts a valid mongo id param", async () => {
      const agent = buildValidatorHarness(validateRoleId, { method: "get", path: "/test/:roleId" });
      const res = await agent.get(`/test/${new Types.ObjectId().toString()}`);
      assert.equal(res.status, 200);
    });
  });
});