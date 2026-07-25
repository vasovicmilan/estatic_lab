import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as dbHandler from "../setup/db-handler.js";
import commissionRepo from "../../../src/repositories/commission-entry.repository.js";
import "../../../src/models/order.model.js";

function validEntry(overrides = {}) {
  return {
    earnerType: "employee",
    employee: new mongoose.Types.ObjectId(),
    sourceType: "appointment",
    appointment: new mongoose.Types.ObjectId(),
    baseValue: 2000,
    rate: 20,
    amount: 400,
    status: "pending",
    ...overrides,
  };
}

describe("commission-entry.repository", () => {
  before(async () => {
    await dbHandler.connect();
  });

  after(async () => {
    await dbHandler.closeDatabase();
  });

  afterEach(async () => {
    await dbHandler.clearDatabase();
  });

  describe("createCommissionEntry / findCommissionEntryById", () => {
    it("persists an entry with default status 'pending'", async () => {
      const created = await commissionRepo.createCommissionEntry(validEntry());
      assert.ok(created._id);
      assert.equal(created.status, "pending");
    });

    it("persists the employeeSnapshot alongside the employee ref", async () => {
      const created = await commissionRepo.createCommissionEntry(validEntry({ employeeSnapshot: { name: "Marko Markovic" } }));
      const found = await commissionRepo.findCommissionEntryById(created._id);
      assert.equal(found.employeeSnapshot.name, "Marko Markovic");
    });

    it("returns null for a nonexistent id", async () => {
      const found = await commissionRepo.findCommissionEntryById(new mongoose.Types.ObjectId());
      assert.equal(found, null);
    });

    it("rejects an entry missing a required field (baseValue) at the schema level", async () => {
      const { baseValue, ...withoutBaseValue } = validEntry();
      await assert.rejects(() => commissionRepo.createCommissionEntry(withoutBaseValue));
    });
  });

  describe("findPendingOrderCommissions - the grace-period cron's scan", () => {
    it("only returns order-sourced, pending entries - not appointment/package_purchase sourced, not earned/reversed", async () => {
      const orderId = new mongoose.Types.ObjectId();
      const matching = await commissionRepo.createCommissionEntry(
        validEntry({ earnerType: "partner", partner: new mongoose.Types.ObjectId(), sourceType: "order", order: orderId, appointment: null, status: "pending" })
      );
      // wrong sourceType - must be excluded
      await commissionRepo.createCommissionEntry(validEntry({ sourceType: "appointment", status: "pending" }));
      // right sourceType, wrong status - must be excluded
      await commissionRepo.createCommissionEntry(
        validEntry({ earnerType: "partner", partner: new mongoose.Types.ObjectId(), sourceType: "order", order: new mongoose.Types.ObjectId(), appointment: null, status: "earned" })
      );

      const pending = await commissionRepo.findPendingOrderCommissions();

      // .populate("order") correctly resolves to null here since no real Order
      // document exists for this raw ObjectId - identity is checked via the
      // entry's own _id instead, not the (now-null) populated order field.
      assert.equal(pending.length, 1);
      assert.equal(String(pending[0]._id), String(matching._id));
    });
  });

  describe("findPendingCommissionByOrder", () => {
    it("finds the pending entry for one specific order", async () => {
      const orderId = new mongoose.Types.ObjectId();
      await commissionRepo.createCommissionEntry(
        validEntry({ earnerType: "partner", partner: new mongoose.Types.ObjectId(), sourceType: "order", order: orderId, appointment: null, status: "pending" })
      );

      const found = await commissionRepo.findPendingCommissionByOrder(orderId);

      assert.ok(found);
      assert.equal(String(found.order), String(orderId));
    });

    it("returns null once that order's entry is no longer pending", async () => {
      const orderId = new mongoose.Types.ObjectId();
      await commissionRepo.createCommissionEntry(
        validEntry({ earnerType: "partner", partner: new mongoose.Types.ObjectId(), sourceType: "order", order: orderId, appointment: null, status: "earned" })
      );

      const found = await commissionRepo.findPendingCommissionByOrder(orderId);

      assert.equal(found, null);
    });
  });

  describe("findEarnedCommissionByPackagePurchase", () => {
    it("finds the earned entry for one specific package purchase", async () => {
      const purchaseId = new mongoose.Types.ObjectId();
      await commissionRepo.createCommissionEntry(
        validEntry({
          earnerType: "partner",
          partner: new mongoose.Types.ObjectId(),
          sourceType: "package_purchase",
          packagePurchase: purchaseId,
          appointment: null,
          status: "earned",
        })
      );

      const found = await commissionRepo.findEarnedCommissionByPackagePurchase(purchaseId);

      assert.ok(found);
      assert.equal(String(found.packagePurchase), String(purchaseId));
    });

    it("does not match a reversed entry for the same purchase (already handled, nothing left to reverse)", async () => {
      const purchaseId = new mongoose.Types.ObjectId();
      await commissionRepo.createCommissionEntry(
        validEntry({
          earnerType: "partner",
          partner: new mongoose.Types.ObjectId(),
          sourceType: "package_purchase",
          packagePurchase: purchaseId,
          appointment: null,
          status: "reversed",
        })
      );

      const found = await commissionRepo.findEarnedCommissionByPackagePurchase(purchaseId);

      assert.equal(found, null);
    });
  });

  describe("findCommissionEntries - filtering and pagination", () => {
    it("filters by employee", async () => {
      const employeeId = new mongoose.Types.ObjectId();
      await commissionRepo.createCommissionEntry(validEntry({ employee: employeeId }));
      await commissionRepo.createCommissionEntry(validEntry({ employee: new mongoose.Types.ObjectId() }));

      const result = await commissionRepo.findCommissionEntries({ filters: { employee: employeeId } });

      assert.equal(result.total, 1);
      assert.equal(String(result.data[0].employee), String(employeeId));
    });

    it("filters by status", async () => {
      await commissionRepo.createCommissionEntry(validEntry({ status: "pending" }));
      await commissionRepo.createCommissionEntry(validEntry({ status: "earned" }));

      const result = await commissionRepo.findCommissionEntries({ filters: { status: "earned" } });

      assert.equal(result.total, 1);
      assert.equal(result.data[0].status, "earned");
    });

    it("sorts newest first and paginates", async () => {
      for (let i = 0; i < 3; i++) {
        await commissionRepo.createCommissionEntry(validEntry());
      }

      const result = await commissionRepo.findCommissionEntries({ limit: 2, page: 1 });

      assert.equal(result.data.length, 2);
      assert.equal(result.total, 3);
      assert.equal(result.totalPages, 2);
    });
  });

  describe("sumEarnedAmount - the payable balance building block", () => {
    it("sums only 'earned' entries for the given employee, excluding pending and reversed", async () => {
      const employeeId = new mongoose.Types.ObjectId();
      await commissionRepo.createCommissionEntry(validEntry({ employee: employeeId, status: "earned", amount: 500 }));
      await commissionRepo.createCommissionEntry(validEntry({ employee: employeeId, status: "earned", amount: 300 }));
      await commissionRepo.createCommissionEntry(validEntry({ employee: employeeId, status: "pending", amount: 1000 }));
      await commissionRepo.createCommissionEntry(validEntry({ employee: employeeId, status: "reversed", amount: 1000 }));

      const total = await commissionRepo.sumEarnedAmount({ employee: employeeId });

      assert.equal(total, 800);
    });

    it("scopes strictly to the given employee, not another employee's earnings", async () => {
      const employeeId = new mongoose.Types.ObjectId();
      await commissionRepo.createCommissionEntry(validEntry({ employee: employeeId, status: "earned", amount: 500 }));
      await commissionRepo.createCommissionEntry(validEntry({ employee: new mongoose.Types.ObjectId(), status: "earned", amount: 999 }));

      const total = await commissionRepo.sumEarnedAmount({ employee: employeeId });

      assert.equal(total, 500);
    });

    it("sums by partner instead when given a partner ref", async () => {
      const partnerId = new mongoose.Types.ObjectId();
      await commissionRepo.createCommissionEntry(
        validEntry({ earnerType: "partner", employee: null, partner: partnerId, sourceType: "order", appointment: null, order: new mongoose.Types.ObjectId(), status: "earned", amount: 700 })
      );

      const total = await commissionRepo.sumEarnedAmount({ partner: partnerId });

      assert.equal(total, 700);
    });

    it("returns 0 (not null/undefined) when there's nothing earned yet", async () => {
      const total = await commissionRepo.sumEarnedAmount({ employee: new mongoose.Types.ObjectId() });
      assert.equal(total, 0);
    });
  });

  describe("updateCommissionEntryById", () => {
    it("updates status and returns the post-update document", async () => {
      const created = await commissionRepo.createCommissionEntry(validEntry({ status: "pending" }));
      const updated = await commissionRepo.updateCommissionEntryById(created._id, { status: "earned", earnedAt: new Date() });
      assert.equal(updated.status, "earned");
      assert.ok(updated.earnedAt);
    });
  });

  describe("countCommissionEntries - used to guard Employee/Partner deletion", () => {
    it("counts only entries matching employee + status, ignoring everything else", async () => {
      const employeeId = new mongoose.Types.ObjectId();
      await commissionRepo.createCommissionEntry(validEntry({ employee: employeeId, status: "pending" }));
      await commissionRepo.createCommissionEntry(validEntry({ employee: employeeId, status: "earned" }));
      await commissionRepo.createCommissionEntry(validEntry({ employee: new mongoose.Types.ObjectId(), status: "pending" }));

      const count = await commissionRepo.countCommissionEntries({ employee: employeeId, status: "pending" });

      assert.equal(count, 1);
    });

    it("returns 0 when nothing matches, letting a delete proceed", async () => {
      const count = await commissionRepo.countCommissionEntries({ employee: new mongoose.Types.ObjectId(), status: "pending" });
      assert.equal(count, 0);
    });
  });
});