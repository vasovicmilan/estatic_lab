import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import partnerRepo from "../../../src/repositories/partner.repository.js";
import userRepo from "../../../src/repositories/user.repository.js";
import commissionEntryRepo from "../../../src/repositories/commission-entry.repository.js";
import payoutRequestRepo from "../../../src/repositories/payout-request.repository.js";
import couponRepo from "../../../src/repositories/coupon.repository.js";
import roleService from "../../../src/services/role.service.js";
import * as partnerService from "../../../src/services/partner.service.js";
import { buildRole, id } from "../../helpers/factories.js";

// deletePartnerById wraps its auto-cleanup + delete in a real Mongo transaction -
// faking the session lets this run as a pure unit test instead of needing a
// replica-set-backed mongodb-memory-server instance.
function mockSession(t) {
  t.mock.method(mongoose, "startSession", async () => ({
    withTransaction: async (fn) => fn(),
    endSession: async () => {},
  }));
}

function buildPartner(overrides = {}) {
  return {
    _id: id(),
    userId: { _id: id(), firstName: "Petar", lastName: "Petrovic", email: "petar@example.com" },
    commissionRate: 10,
    isActive: true,
    notes: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("partner.service", () => {
  describe("createPartner - validation", () => {
    it("requires a commissionRate to be provided at all", async () => {
      await assert.rejects(() => partnerService.createPartner({ userId: id() }), (err) => err.statusCode === 400);
    });

    it("rejects a commissionRate below 0", async () => {
      await assert.rejects(
        () => partnerService.createPartner({ userId: id(), commissionRate: -5 }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a commissionRate above 100", async () => {
      await assert.rejects(
        () => partnerService.createPartner({ userId: id(), commissionRate: 150 }),
        (err) => err.statusCode === 400
      );
    });

    it("rejects a user who already has a partner profile", async (t) => {
      t.mock.method(partnerRepo, "findPartnerByUserId", async () => buildPartner());
      await assert.rejects(
        () => partnerService.createPartner({ userId: id(), commissionRate: 10 }),
        (err) => err.statusCode === 409
      );
    });

    it("throws if the 'partner' role isn't configured", async (t) => {
      t.mock.method(partnerRepo, "findPartnerByUserId", async () => null);
      t.mock.method(roleService, "findRoleByName", async () => null);
      await assert.rejects(
        () => partnerService.createPartner({ userId: id(), commissionRate: 10 }),
        (err) => err.statusCode === 400
      );
    });
  });

  describe("createPartner - role promotion", () => {
    it("promotes the target user's role to 'partner' on success", async (t) => {
      t.mock.method(partnerRepo, "findPartnerByUserId", async () => null);
      const partnerRole = buildRole({ name: "partner", priority: 40 });
      t.mock.method(roleService, "findRoleByName", async () => partnerRole);
      const created = buildPartner();
      t.mock.method(partnerRepo, "createPartner", async () => created);
      t.mock.method(userRepo, "findUserById", async () => ({ role: { priority: 0, name: "user" } }));
      let updatedRolePayload;
      t.mock.method(userRepo, "updateUserById", async (userId, patch) => {
        updatedRolePayload = patch;
      });
      t.mock.method(partnerRepo, "findPartnerById", async () => created);

      await partnerService.createPartner({ userId: id(), commissionRate: 10 });

      assert.deepEqual(updatedRolePayload.role, partnerRole._id);
    });

    it("does NOT downgrade a user who already has a higher-priority role (e.g. admin)", async (t) => {
      t.mock.method(partnerRepo, "findPartnerByUserId", async () => null);
      const partnerRole = buildRole({ name: "partner", priority: 40 });
      t.mock.method(roleService, "findRoleByName", async () => partnerRole);
      const created = buildPartner();
      t.mock.method(partnerRepo, "createPartner", async () => created);
      t.mock.method(userRepo, "findUserById", async () => ({ role: { priority: 100, name: "admin" } }));
      let updateCalled = false;
      t.mock.method(userRepo, "updateUserById", async () => {
        updateCalled = true;
      });
      t.mock.method(partnerRepo, "findPartnerById", async () => created);

      await partnerService.createPartner({ userId: id(), commissionRate: 10 });

      assert.equal(updateCalled, false, "an existing admin's role must never be silently downgraded to partner");
    });
  });

  describe("updatePartnerById", () => {
    it("rejects an out-of-range commissionRate on update too", async () => {
      await assert.rejects(
        () => partnerService.updatePartnerById(id().toString(), { commissionRate: 200 }),
        (err) => err.statusCode === 400
      );
    });

    it("throws 404 when the partner doesn't exist", async (t) => {
      t.mock.method(partnerRepo, "updatePartnerById", async () => null);
      await assert.rejects(() => partnerService.updatePartnerById(id().toString(), { notes: "x" }), (err) => err.statusCode === 404);
    });

    it("allows an update that omits commissionRate entirely (partial update)", async (t) => {
      const updated = buildPartner();
      t.mock.method(partnerRepo, "updatePartnerById", async () => updated);
      t.mock.method(partnerRepo, "findPartnerById", async () => updated);

      // should NOT throw
      await partnerService.updatePartnerById(id().toString(), { notes: "Nova napomena" });
    });
  });

  describe("getPartnerById / getPartnerForEdit / findPartnerProfile", () => {
    it("getPartnerById throws 404 for a nonexistent partner", async (t) => {
      t.mock.method(partnerRepo, "findPartnerById", async () => null);
      await assert.rejects(() => partnerService.getPartnerById(id().toString()), (err) => err.statusCode === 404);
    });

    it("getPartnerForEdit throws 404 for a nonexistent partner", async (t) => {
      t.mock.method(partnerRepo, "findPartnerById", async () => null);
      await assert.rejects(() => partnerService.getPartnerForEdit(id().toString()), (err) => err.statusCode === 404);
    });

    it("findPartnerProfile throws 404 when the user has no partner profile", async (t) => {
      t.mock.method(partnerRepo, "findPartnerByUserId", async () => null);
      await assert.rejects(() => partnerService.findPartnerProfile(id().toString()), (err) => err.statusCode === 404);
    });

    it("findPartnerProfile returns the partner-role mapped shape when a profile exists", async (t) => {
      const partner = buildPartner();
      t.mock.method(partnerRepo, "findPartnerByUserId", async () => partner);

      const result = await partnerService.findPartnerProfile(partner.userId._id.toString());

      assert.equal(result.id, partner._id.toString());
    });
  });

  describe("deletePartnerById", () => {
    it("throws 404 for a nonexistent partner", async (t) => {
      t.mock.method(partnerRepo, "findPartnerById", async () => null);
      await assert.rejects(() => partnerService.deletePartnerById(id().toString()), (err) => err.statusCode === 404);
    });

    function mockNoBlockingReferences(t) {
      t.mock.method(commissionEntryRepo, "countCommissionEntries", async () => 0);
      t.mock.method(payoutRequestRepo, "countPayoutRequests", async () => 0);
    }

    it("deletes a partner with no pending commission/payout, pulling it from Coupon", async (t) => {
      mockSession(t);
      t.mock.method(partnerRepo, "findPartnerById", async () => buildPartner());
      t.mock.method(partnerRepo, "deletePartnerById", async () => true);
      mockNoBlockingReferences(t);

      let unsetCalls = 0;
      t.mock.method(couponRepo, "unsetPartnerFromAllCoupons", async () => {
        unsetCalls++;
      });

      const result = await partnerService.deletePartnerById(id().toString());

      assert.equal(result.success, true);
      assert.equal(unsetCalls, 1);
    });

    it("aborts the whole transaction and never reaches the terminal delete when the cleanup step fails", async (t) => {
      mockSession(t);
      t.mock.method(partnerRepo, "findPartnerById", async () => buildPartner());
      mockNoBlockingReferences(t);
      t.mock.method(couponRepo, "unsetPartnerFromAllCoupons", async () => {
        throw new Error("Simulated write failure mid-transaction");
      });
      let deleteCalled = false;
      t.mock.method(partnerRepo, "deletePartnerById", async () => {
        deleteCalled = true;
        return true;
      });

      await assert.rejects(() => partnerService.deletePartnerById(id().toString()), /Simulated write failure/);

      assert.equal(deleteCalled, false, "the partner itself must not be deleted if the cleanup step failed");
    });

    it("always ends the session, even when the transaction throws", async (t) => {
      let endSessionCalls = 0;
      t.mock.method(mongoose, "startSession", async () => ({
        withTransaction: async (fn) => fn(),
        endSession: async () => {
          endSessionCalls++;
        },
      }));
      t.mock.method(partnerRepo, "findPartnerById", async () => buildPartner());
      mockNoBlockingReferences(t);
      t.mock.method(couponRepo, "unsetPartnerFromAllCoupons", async () => {
        throw new Error("Simulated write failure mid-transaction");
      });

      await assert.rejects(() => partnerService.deletePartnerById(id().toString()));

      assert.equal(endSessionCalls, 1, "a leaked session (never ended) is a real resource leak, transaction failed or not");
    });

    it("refuses to delete a partner with a commission still pending (not yet earned/reversed)", async (t) => {
      t.mock.method(partnerRepo, "findPartnerById", async () => buildPartner());
      mockNoBlockingReferences(t);
      t.mock.method(commissionEntryRepo, "countCommissionEntries", async () => 1);

      await assert.rejects(() => partnerService.deletePartnerById(id().toString()), (err) => err.statusCode === 400);
    });

    it("refuses to delete a partner with a payout still requested/approved (not yet paid/rejected)", async (t) => {
      t.mock.method(partnerRepo, "findPartnerById", async () => buildPartner());
      mockNoBlockingReferences(t);
      t.mock.method(payoutRequestRepo, "countPayoutRequests", async () => 1);

      await assert.rejects(() => partnerService.deletePartnerById(id().toString()), (err) => err.statusCode === 400);
    });
  });

  describe("listPartners", () => {
    it("uses the admin list mapper for role=admin", async (t) => {
      t.mock.method(partnerRepo, "findPartners", async () => ({
        data: [buildPartner()],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }));

      const result = await partnerService.listPartners({ role: "admin" });

      assert.equal(result.data.length, 1);
      assert.equal(result.total, 1);
    });
  });

  describe("getAllPartnerUserIds", () => {
    it("forwards straight to the repository", async (t) => {
      const ids = [id().toString(), id().toString()];
      t.mock.method(partnerRepo, "findAllPartnerUserIds", async () => ids);

      const result = await partnerService.getAllPartnerUserIds();

      assert.deepEqual(result, ids);
    });
  });
});