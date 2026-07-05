import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import employeeRepo from "../../../src/repositories/employee.repository.js";
import Role from "../../../src/models/role.model.js";
import User from "../../../src/models/user.model.js";

async function ensureEmployeeRole() {
  const existing = await Role.findOne({ name: "employee" });
  if (existing) return existing;
  return Role.create({ name: "employee", isDefault: false });
}

async function createTestUser(overrides = {}) {
  const role = await ensureEmployeeRole();
  return User.create({
    email: `zaposleni-${new mongoose.Types.ObjectId()}@example.com`,
    password: "lozinka123",
    firstName: "Ana",
    lastName: "Anic",
    role: role._id,
    ...overrides,
  });
}

describe("employee.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createEmployee", () => {
    it("persists an employee linked to a user", async () => {
      const user = await createTestUser();
      const employee = await employeeRepo.createEmployee({ userId: user._id });

      assert.ok(employee._id);
      assert.equal(String(employee.userId), String(user._id));
      assert.equal(employee.isActive, true, "isActive should default to true");
    });

    it("rejects a second employee profile for the same user (unique index)", async () => {
      const user = await createTestUser();
      await employeeRepo.createEmployee({ userId: user._id });

      await assert.rejects(() => employeeRepo.createEmployee({ userId: user._id }));
    });

    it("rejects a workingHours entry with an invalid day at the schema level", async () => {
      const user = await createTestUser();
      await assert.rejects(() =>
        employeeRepo.createEmployee({ userId: user._id, workingHours: [{ day: "funday", slots: [] }] })
      );
    });
  });

  describe("findEmployeeById", () => {
    it("returns null for a nonexistent id", async () => {
      const found = await employeeRepo.findEmployeeById(new mongoose.Types.ObjectId());
      assert.equal(found, null);
    });

    it("populates the linked user when requested", async () => {
      const user = await createTestUser({ firstName: "Jovana" });
      const created = await employeeRepo.createEmployee({ userId: user._id });

      const found = await employeeRepo.findEmployeeById(created._id, {
        populateFields: [{ path: "userId", select: "firstName lastName email phone" }],
      });

      assert.equal(found.userId.firstName, "Jovana");
    });
  });

  describe("findEmployeeByUserId", () => {
    it("finds the employee profile belonging to a given user", async () => {
      const user = await createTestUser();
      await employeeRepo.createEmployee({ userId: user._id });

      const found = await employeeRepo.findEmployeeByUserId(user._id);

      assert.ok(found);
      assert.equal(String(found.userId), String(user._id));
    });

    it("returns null when the user has no employee profile", async () => {
      const user = await createTestUser();
      const found = await employeeRepo.findEmployeeByUserId(user._id);
      assert.equal(found, null);
    });
  });

  describe("findEmployeesByService", () => {
    it("returns only employees who can perform the given service", async () => {
      const serviceId = new mongoose.Types.ObjectId();
      const otherServiceId = new mongoose.Types.ObjectId();
      const userA = await createTestUser();
      const userB = await createTestUser();
      await employeeRepo.createEmployee({ userId: userA._id, services: [serviceId] });
      await employeeRepo.createEmployee({ userId: userB._id, services: [otherServiceId] });

      const result = await employeeRepo.findEmployeesByService(serviceId);

      assert.equal(result.length, 1);
      assert.equal(String(result[0].userId), String(userA._id));
    });

    it("excludes inactive employees by default", async () => {
      const serviceId = new mongoose.Types.ObjectId();
      const user = await createTestUser();
      await employeeRepo.createEmployee({ userId: user._id, services: [serviceId], isActive: false });

      const result = await employeeRepo.findEmployeesByService(serviceId);

      assert.equal(result.length, 0);
    });

    it("includes inactive employees when onlyActive is false", async () => {
      const serviceId = new mongoose.Types.ObjectId();
      const user = await createTestUser();
      await employeeRepo.createEmployee({ userId: user._id, services: [serviceId], isActive: false });

      const result = await employeeRepo.findEmployeesByService(serviceId, { onlyActive: false });

      assert.equal(result.length, 1);
    });
  });

  describe("findEmployees", () => {
    it("filters by isActive", async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();
      await employeeRepo.createEmployee({ userId: userA._id, isActive: true });
      await employeeRepo.createEmployee({ userId: userB._id, isActive: false });

      const result = await employeeRepo.findEmployees({ filters: { isActive: true } });

      assert.equal(result.data.length, 1);
      assert.equal(String(result.data[0].userId._id ?? result.data[0].userId), String(userA._id));
    });

    it("paginates results", async () => {
      for (let i = 0; i < 3; i++) {
        const user = await createTestUser();
        await employeeRepo.createEmployee({ userId: user._id });
      }

      const result = await employeeRepo.findEmployees({ limit: 2, page: 1 });

      assert.equal(result.data.length, 2);
      assert.equal(result.total, 3);
      assert.equal(result.totalPages, 2);
    });
  });

  describe("updateEmployeeById", () => {
    it("updates and returns the post-update document", async () => {
      const user = await createTestUser();
      const created = await employeeRepo.createEmployee({ userId: user._id });

      const updated = await employeeRepo.updateEmployeeById(created._id, { notes: "Odlican zaposleni" });

      assert.equal(updated.notes, "Odlican zaposleni");
    });
  });

  describe("deleteEmployeeById", () => {
    it("deletes the employee", async () => {
      const user = await createTestUser();
      const created = await employeeRepo.createEmployee({ userId: user._id });

      await employeeRepo.deleteEmployeeById(created._id);
      const found = await employeeRepo.findEmployeeById(created._id);

      assert.equal(found, null);
    });
  });

  describe("countEmployees", () => {
    it("counts employees matching a filter", async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();
      await employeeRepo.createEmployee({ userId: userA._id, isActive: true });
      await employeeRepo.createEmployee({ userId: userB._id, isActive: false });

      const count = await employeeRepo.countEmployees({ isActive: true });

      assert.equal(count, 1);
    });
  });
});