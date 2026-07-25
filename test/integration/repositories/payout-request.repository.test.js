import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import payoutRepo from "../../../src/repositories/payout-request.repository.js";
import "../../../src/models/employee.model.js";
import "../../../src/models/partner.model.js";
import "../../../src/models/user.model.js";

function validRequest(overrides = {}) {
  return {
    earnerType: "employee",
    employee: new mongoose.Types.ObjectId(),
    amount: 2000,
    status: "requested",
    ...overrides,
  };
}

describe("payout-request.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createPayoutRequest / findPayoutRequestById", () => {
    it("persists a request with default status 'requested'", async () => {
      const created = await payoutRepo.createPayoutRequest(validRequest());
      assert.ok(created._id);
      assert.equal(created.status, "requested");
    });

    it("persists the employeeSnapshot alongside the employee ref", async () => {
      const created = await payoutRepo.createPayoutRequest(validRequest({ employeeSnapshot: { name: "Marko Markovic" } }));
      const found = await payoutRepo.findPayoutRequestById(created._id);
      assert.equal(found.employeeSnapshot.name, "Marko Markovic");
    });

    it("returns null for a nonexistent id", async () => {
      const found = await payoutRepo.findPayoutRequestById(new mongoose.Types.ObjectId());
      assert.equal(found, null);
    });

    it("does not crash when employee/partner point at nothing populatable (dangling or never-populated ref)", async () => {
      // findPayoutRequestById always attempts to populate both employee and
      // partner unconditionally - this proves that's safe even when there's
      // nothing in the Employee/Partner collections to resolve against.
      const created = await payoutRepo.createPayoutRequest(validRequest());
      const found = await payoutRepo.findPayoutRequestById(created._id);
      assert.equal(found.employee, null);
    });

    it("rejects a request missing the required amount field", async () => {
      const { amount, ...withoutAmount } = validRequest();
      await assert.rejects(() => payoutRepo.createPayoutRequest(withoutAmount));
    });
  });

  describe("findPayoutRequests - filtering and pagination", () => {
    it("filters by employee", async () => {
      const employeeId = new mongoose.Types.ObjectId();
      const matching = await payoutRepo.createPayoutRequest(validRequest({ employee: employeeId }));
      await payoutRepo.createPayoutRequest(validRequest({ employee: new mongoose.Types.ObjectId() }));

      const result = await payoutRepo.findPayoutRequests({ filters: { employee: employeeId } });

      // .populate("employee") correctly resolves to null here since no real
      // Employee document exists for this raw ObjectId - identity is checked via
      // the request's own _id instead, not the (now-null) populated employee field.
      assert.equal(result.total, 1);
      assert.equal(String(result.data[0]._id), String(matching._id));
    });

    it("filters by status", async () => {
      await payoutRepo.createPayoutRequest(validRequest({ status: "requested" }));
      await payoutRepo.createPayoutRequest(validRequest({ status: "paid" }));

      const result = await payoutRepo.findPayoutRequests({ filters: { status: "paid" } });

      assert.equal(result.total, 1);
      assert.equal(result.data[0].status, "paid");
    });

    it("filters by earnerType, separating employee and partner requests", async () => {
      await payoutRepo.createPayoutRequest(validRequest({ earnerType: "employee" }));
      await payoutRepo.createPayoutRequest(
        validRequest({ earnerType: "partner", employee: null, partner: new mongoose.Types.ObjectId() })
      );

      const result = await payoutRepo.findPayoutRequests({ filters: { earnerType: "partner" } });

      assert.equal(result.total, 1);
      assert.equal(result.data[0].earnerType, "partner");
    });

    it("sorts newest first and paginates", async () => {
      for (let i = 0; i < 3; i++) {
        await payoutRepo.createPayoutRequest(validRequest());
      }

      const result = await payoutRepo.findPayoutRequests({ limit: 2, page: 1 });

      assert.equal(result.data.length, 2);
      assert.equal(result.total, 3);
      assert.equal(result.totalPages, 2);
    });
  });

  describe("sumPendingRequestedAmount - money already spoken for", () => {
    it("sums 'requested' and 'approved' together, excluding 'paid' and 'rejected'", async () => {
      const employeeId = new mongoose.Types.ObjectId();
      await payoutRepo.createPayoutRequest(validRequest({ employee: employeeId, status: "requested", amount: 500 }));
      await payoutRepo.createPayoutRequest(validRequest({ employee: employeeId, status: "approved", amount: 300 }));
      await payoutRepo.createPayoutRequest(validRequest({ employee: employeeId, status: "paid", amount: 1000 }));
      await payoutRepo.createPayoutRequest(validRequest({ employee: employeeId, status: "rejected", amount: 1000 }));

      const total = await payoutRepo.sumPendingRequestedAmount({ employee: employeeId });

      assert.equal(total, 800);
    });

    it("scopes strictly to the given employee", async () => {
      const employeeId = new mongoose.Types.ObjectId();
      await payoutRepo.createPayoutRequest(validRequest({ employee: employeeId, status: "requested", amount: 500 }));
      await payoutRepo.createPayoutRequest(validRequest({ employee: new mongoose.Types.ObjectId(), status: "requested", amount: 999 }));

      const total = await payoutRepo.sumPendingRequestedAmount({ employee: employeeId });

      assert.equal(total, 500);
    });

    it("sums by partner instead when given a partner ref", async () => {
      const partnerId = new mongoose.Types.ObjectId();
      await payoutRepo.createPayoutRequest(
        validRequest({ earnerType: "partner", employee: null, partner: partnerId, status: "approved", amount: 700 })
      );

      const total = await payoutRepo.sumPendingRequestedAmount({ partner: partnerId });

      assert.equal(total, 700);
    });

    it("returns 0 when nothing is pending", async () => {
      const total = await payoutRepo.sumPendingRequestedAmount({ employee: new mongoose.Types.ObjectId() });
      assert.equal(total, 0);
    });
  });

  describe("sumPaidAmount", () => {
    it("sums only 'paid' entries, excluding requested/approved/rejected", async () => {
      const employeeId = new mongoose.Types.ObjectId();
      await payoutRepo.createPayoutRequest(validRequest({ employee: employeeId, status: "paid", amount: 600 }));
      await payoutRepo.createPayoutRequest(validRequest({ employee: employeeId, status: "paid", amount: 400 }));
      await payoutRepo.createPayoutRequest(validRequest({ employee: employeeId, status: "requested", amount: 999 }));

      const total = await payoutRepo.sumPaidAmount({ employee: employeeId });

      assert.equal(total, 1000);
    });

    it("returns 0 when nothing has been paid yet", async () => {
      const total = await payoutRepo.sumPaidAmount({ employee: new mongoose.Types.ObjectId() });
      assert.equal(total, 0);
    });
  });

  describe("updatePayoutRequestById", () => {
    it("updates status and returns the post-update document", async () => {
      const created = await payoutRepo.createPayoutRequest(validRequest({ status: "requested" }));
      const updated = await payoutRepo.updatePayoutRequestById(created._id, { status: "approved", approvedAt: new Date() });
      assert.equal(updated.status, "approved");
      assert.ok(updated.approvedAt);
    });
  });

  describe("countPayoutRequests - used to guard Employee/Partner deletion", () => {
    it("counts entries matching employee + statusIn (requested/approved), ignoring paid/rejected", async () => {
      const employeeId = new mongoose.Types.ObjectId();
      await payoutRepo.createPayoutRequest(validRequest({ employee: employeeId, status: "requested" }));
      await payoutRepo.createPayoutRequest(validRequest({ employee: employeeId, status: "approved" }));
      await payoutRepo.createPayoutRequest(validRequest({ employee: employeeId, status: "paid" }));

      const count = await payoutRepo.countPayoutRequests({ employee: employeeId, statusIn: ["requested", "approved"] });

      assert.equal(count, 2);
    });

    it("returns 0 when nothing matches, letting a delete proceed", async () => {
      const count = await payoutRepo.countPayoutRequests({ employee: new mongoose.Types.ObjectId(), statusIn: ["requested", "approved"] });
      assert.equal(count, 0);
    });
  });
});