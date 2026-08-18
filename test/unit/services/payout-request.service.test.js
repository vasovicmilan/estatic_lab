import { describe, it } from "node:test";
import assert from "node:assert/strict";
import payoutRepo from "../../../src/repositories/payout-request.repository.js";
import commissionService from "../../../src/services/commission.service.js";
import employeeService from "../../../src/services/employee.service.js";
import eventEmitter from "../../../src/events/event.emitter.js";
import * as payoutService from "../../../src/services/payout-request.service.js";
import { buildPayoutRequest, id } from "../../helpers/factories.js";

describe("payout-request.service", () => {
  describe("getBalance", () => {
    it("rejects an earnerType that isn't 'employee' or 'partner'", async () => {
      await assert.rejects(() => payoutService.getBalance("robot", id().toString()), (err) => err.statusCode === 400);
    });

    it("computes available as earned - paid - reserved, floored at 0", async (t) => {
      t.mock.method(commissionService, "getEarnedTotal", async () => 5000);
      t.mock.method(payoutRepo, "sumPendingRequestedAmount", async () => 1000);
      t.mock.method(payoutRepo, "sumPaidAmount", async () => 2000);

      const balance = await payoutService.getBalance("employee", id().toString());

      assert.deepEqual(balance, { earned: 5000, paid: 2000, reserved: 1000, available: 2000 });
    });

    it("never returns a negative available balance even if paid+reserved exceeds earned", async (t) => {
      t.mock.method(commissionService, "getEarnedTotal", async () => 1000);
      t.mock.method(payoutRepo, "sumPendingRequestedAmount", async () => 500);
      t.mock.method(payoutRepo, "sumPaidAmount", async () => 800);

      const balance = await payoutService.getBalance("employee", id().toString());

      assert.equal(balance.available, 0);
    });

    it("queries by { employee } for an employee earner and { partner } for a partner earner", async (t) => {
      const earnedMock = t.mock.method(commissionService, "getEarnedTotal", async () => 0);
      t.mock.method(payoutRepo, "sumPendingRequestedAmount", async () => 0);
      t.mock.method(payoutRepo, "sumPaidAmount", async () => 0);
      const partnerId = id();

      await payoutService.getBalance("partner", partnerId.toString());

      assert.deepEqual(earnedMock.mock.calls[0].arguments[0], { partner: partnerId.toString() });
    });
  });

  describe("requestPayout", () => {
    it("rejects a missing or non-positive amount", async () => {
      await assert.rejects(() => payoutService.requestPayout("employee", id().toString(), 0), (err) => err.statusCode === 400);
      await assert.rejects(() => payoutService.requestPayout("employee", id().toString(), -5), (err) => err.statusCode === 400);
    });

    it("rejects a request for more than the earner's available balance", async (t) => {
      t.mock.method(commissionService, "getEarnedTotal", async () => 1000);
      t.mock.method(payoutRepo, "sumPendingRequestedAmount", async () => 0);
      t.mock.method(payoutRepo, "sumPaidAmount", async () => 0);
      const createMock = t.mock.method(payoutRepo, "createPayoutRequest", async () => buildPayoutRequest());

      await assert.rejects(
        () => payoutService.requestPayout("employee", id().toString(), 5000),
        (err) => err.statusCode === 400
      );
      assert.equal(createMock.mock.calls.length, 0, "no request should be created once the balance check fails");
    });

    it("creates a 'requested' entry with an employeeSnapshot for an employee earner", async (t) => {
      t.mock.method(commissionService, "getEarnedTotal", async () => 5000);
      t.mock.method(payoutRepo, "sumPendingRequestedAmount", async () => 0);
      t.mock.method(payoutRepo, "sumPaidAmount", async () => 0);
      t.mock.method(employeeService, "getEmployeeNameById", async () => "Marko Markovic");
      const createMock = t.mock.method(payoutRepo, "createPayoutRequest", async (data) => buildPayoutRequest(data));
      const employeeId = id();

      await payoutService.requestPayout("employee", employeeId.toString(), 2000);

      const payload = createMock.mock.calls[0].arguments[0];
      assert.equal(payload.earnerType, "employee");
      assert.equal(payload.employee, employeeId.toString());
      assert.deepEqual(payload.employeeSnapshot, { name: "Marko Markovic" });
      assert.equal(payload.amount, 2000);
      assert.equal(payload.status, "requested");
      assert.equal(payload.partner, undefined, "an employee request must not carry a partner field");
    });

    it("creates a 'requested' entry with a partner reference (no snapshot) for a partner earner", async (t) => {
      t.mock.method(commissionService, "getEarnedTotal", async () => 5000);
      t.mock.method(payoutRepo, "sumPendingRequestedAmount", async () => 0);
      t.mock.method(payoutRepo, "sumPaidAmount", async () => 0);
      const createMock = t.mock.method(payoutRepo, "createPayoutRequest", async (data) => buildPayoutRequest(data));
      const partnerId = id();

      await payoutService.requestPayout("partner", partnerId.toString(), 2000);

      const payload = createMock.mock.calls[0].arguments[0];
      assert.equal(payload.earnerType, "partner");
      assert.equal(payload.partner, partnerId.toString());
      assert.equal(payload.employee, undefined);
      assert.equal(payload.employeeSnapshot, undefined);
    });

    it("allows a request for exactly the full available balance (boundary, not just strictly less)", async (t) => {
      t.mock.method(commissionService, "getEarnedTotal", async () => 3000);
      t.mock.method(payoutRepo, "sumPendingRequestedAmount", async () => 0);
      t.mock.method(payoutRepo, "sumPaidAmount", async () => 0);
      t.mock.method(employeeService, "getEmployeeNameById", async () => "Marko Markovic");
      const createMock = t.mock.method(payoutRepo, "createPayoutRequest", async (data) => buildPayoutRequest(data));

      await payoutService.requestPayout("employee", id().toString(), 3000);

      assert.equal(createMock.mock.calls.length, 1);
    });
  });

  describe("recordPayoutByAdmin", () => {
    it("rejects a missing or non-positive amount", async () => {
      await assert.rejects(() => payoutService.recordPayoutByAdmin("employee", id().toString(), 0), (err) => err.statusCode === 400);
    });

    it("rejects an amount exceeding the earner's available balance - an admin can't record more than is actually owed", async (t) => {
      t.mock.method(commissionService, "getEarnedTotal", async () => 500);
      t.mock.method(payoutRepo, "sumPendingRequestedAmount", async () => 0);
      t.mock.method(payoutRepo, "sumPaidAmount", async () => 0);
      const createMock = t.mock.method(payoutRepo, "createPayoutRequest", async () => buildPayoutRequest());

      await assert.rejects(
        () => payoutService.recordPayoutByAdmin("employee", id().toString(), 10000),
        (err) => err.statusCode === 400
      );
      assert.equal(createMock.mock.calls.length, 0);
    });

    it("creates an entry that goes straight to 'paid' with both approvedAt and paidAt set, skipping 'requested'/'approved'", async (t) => {
      t.mock.method(commissionService, "getEarnedTotal", async () => 5000);
      t.mock.method(payoutRepo, "sumPendingRequestedAmount", async () => 0);
      t.mock.method(payoutRepo, "sumPaidAmount", async () => 0);
      t.mock.method(employeeService, "getEmployeeNameById", async () => "Marko Markovic");
      const createMock = t.mock.method(payoutRepo, "createPayoutRequest", async (data) => buildPayoutRequest(data));

      await payoutService.recordPayoutByAdmin("employee", id().toString(), 2000, "Isplaćeno gotovinom");

      const payload = createMock.mock.calls[0].arguments[0];
      assert.equal(payload.status, "paid");
      assert.ok(payload.approvedAt instanceof Date);
      assert.ok(payload.paidAt instanceof Date);
      assert.equal(payload.adminNote, "Isplaćeno gotovinom");
    });
  });

  describe("approvePayoutRequest", () => {
    it("throws 404 when the request doesn't exist", async (t) => {
      t.mock.method(payoutRepo, "findPayoutRequestById", async () => null);
      await assert.rejects(() => payoutService.approvePayoutRequest(id().toString()), (err) => err.statusCode === 404);
    });

    it("refuses to approve a request that isn't in 'requested' status", async (t) => {
      t.mock.method(payoutRepo, "findPayoutRequestById", async () => buildPayoutRequest({ status: "approved" }));
      const updateMock = t.mock.method(payoutRepo, "updatePayoutRequestById", async () => ({}));

      await assert.rejects(() => payoutService.approvePayoutRequest(id().toString()), (err) => err.statusCode === 400);
      assert.equal(updateMock.mock.calls.length, 0);
    });

    it("moves a 'requested' entry to 'approved', stamps approvedAt, and emits payout:status_changed", async (t) => {
      const request = buildPayoutRequest({ status: "requested" });
      let findCallCount = 0;
      t.mock.method(payoutRepo, "findPayoutRequestById", async () => {
        findCallCount += 1;
        // second lookup (after the update) reflects the new status
        return findCallCount === 1 ? request : { ...request, status: "approved" };
      });
      const updateMock = t.mock.method(payoutRepo, "updatePayoutRequestById", async () => ({}));
      const emitMock = t.mock.method(eventEmitter, "emit", () => {});

      const result = await payoutService.approvePayoutRequest(request._id.toString(), "u redu je");

      const [, changes] = updateMock.mock.calls[0].arguments;
      assert.equal(changes.status, "approved");
      assert.ok(changes.approvedAt instanceof Date);
      assert.equal(changes.adminNote, "u redu je");
      assert.equal(result.status, "approved");
      assert.equal(emitMock.mock.calls[0].arguments[0], "payout:status_changed");
      assert.equal(emitMock.mock.calls[0].arguments[1].status, "approved");
    });
  });

  describe("markPayoutRequestPaid", () => {
    it("throws 404 when the request doesn't exist", async (t) => {
      t.mock.method(payoutRepo, "findPayoutRequestById", async () => null);
      await assert.rejects(() => payoutService.markPayoutRequestPaid(id().toString()), (err) => err.statusCode === 404);
    });

    it("accepts a request in 'requested' status (approval can be skipped, going straight to paid)", async (t) => {
      const request = buildPayoutRequest({ status: "requested" });
      t.mock.method(payoutRepo, "findPayoutRequestById", async () => request);
      const updateMock = t.mock.method(payoutRepo, "updatePayoutRequestById", async () => ({}));
      t.mock.method(eventEmitter, "emit", () => {});

      await payoutService.markPayoutRequestPaid(request._id.toString());

      assert.equal(updateMock.mock.calls[0].arguments[1].status, "paid");
    });

    it("accepts a request in 'approved' status", async (t) => {
      const request = buildPayoutRequest({ status: "approved" });
      t.mock.method(payoutRepo, "findPayoutRequestById", async () => request);
      const updateMock = t.mock.method(payoutRepo, "updatePayoutRequestById", async () => ({}));
      t.mock.method(eventEmitter, "emit", () => {});

      await payoutService.markPayoutRequestPaid(request._id.toString());

      assert.equal(updateMock.mock.calls.length, 1);
    });

    it("refuses to mark an already-'paid' or 'rejected' request as paid again", async (t) => {
      t.mock.method(payoutRepo, "findPayoutRequestById", async () => buildPayoutRequest({ status: "paid" }));
      await assert.rejects(() => payoutService.markPayoutRequestPaid(id().toString()), (err) => err.statusCode === 400);

      t.mock.method(payoutRepo, "findPayoutRequestById", async () => buildPayoutRequest({ status: "rejected" }));
      await assert.rejects(() => payoutService.markPayoutRequestPaid(id().toString()), (err) => err.statusCode === 400);
    });

    it("stamps paidAt and emits payout:status_changed with status 'paid'", async (t) => {
      const request = buildPayoutRequest({ status: "approved" });
      t.mock.method(payoutRepo, "findPayoutRequestById", async () => request);
      const updateMock = t.mock.method(payoutRepo, "updatePayoutRequestById", async () => ({}));
      const emitMock = t.mock.method(eventEmitter, "emit", () => {});

      await payoutService.markPayoutRequestPaid(request._id.toString());

      assert.ok(updateMock.mock.calls[0].arguments[1].paidAt instanceof Date);
      assert.equal(emitMock.mock.calls[0].arguments[1].status, "paid");
    });
  });

  describe("rejectPayoutRequest", () => {
    it("throws 404 when the request doesn't exist", async (t) => {
      t.mock.method(payoutRepo, "findPayoutRequestById", async () => null);
      await assert.rejects(() => payoutService.rejectPayoutRequest(id().toString()), (err) => err.statusCode === 404);
    });

    it("refuses to reject an already-paid request - money already sent can't be un-sent by a status flip", async (t) => {
      t.mock.method(payoutRepo, "findPayoutRequestById", async () => buildPayoutRequest({ status: "paid" }));
      const updateMock = t.mock.method(payoutRepo, "updatePayoutRequestById", async () => ({}));

      await assert.rejects(() => payoutService.rejectPayoutRequest(id().toString()), (err) => err.statusCode === 400);
      assert.equal(updateMock.mock.calls.length, 0);
    });

    it("allows rejecting either 'requested' or 'approved' - not just the initial state", async (t) => {
      const requested = buildPayoutRequest({ status: "requested" });
      t.mock.method(payoutRepo, "findPayoutRequestById", async () => requested);
      t.mock.method(payoutRepo, "updatePayoutRequestById", async () => ({}));
      t.mock.method(eventEmitter, "emit", () => {});
      await payoutService.rejectPayoutRequest(requested._id.toString());

      const approved = buildPayoutRequest({ status: "approved" });
      t.mock.method(payoutRepo, "findPayoutRequestById", async () => approved);
      const updateMock = t.mock.method(payoutRepo, "updatePayoutRequestById", async () => ({}));
      await payoutService.rejectPayoutRequest(approved._id.toString());

      assert.equal(updateMock.mock.calls[0].arguments[1].status, "rejected");
    });

    it("stamps rejectedAt, stores the adminNote, and emits payout:status_changed with status 'rejected'", async (t) => {
      const request = buildPayoutRequest({ status: "requested" });
      t.mock.method(payoutRepo, "findPayoutRequestById", async () => request);
      const updateMock = t.mock.method(payoutRepo, "updatePayoutRequestById", async () => ({}));
      const emitMock = t.mock.method(eventEmitter, "emit", () => {});

      await payoutService.rejectPayoutRequest(request._id.toString(), "Nedovoljno sredstava");

      const [, changes] = updateMock.mock.calls[0].arguments;
      assert.equal(changes.status, "rejected");
      assert.ok(changes.rejectedAt instanceof Date);
      assert.equal(changes.adminNote, "Nedovoljno sredstava");
      assert.equal(emitMock.mock.calls[0].arguments[1].status, "rejected");
    });
  });

  describe("listPayoutRequests / getPayoutRequestById - admin views", () => {
    it("maps repository results through the admin-list mapper and preserves pagination fields", async (t) => {
      t.mock.method(payoutRepo, "findPayoutRequests", async () => ({
        data: [buildPayoutRequest()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }));

      const result = await payoutService.listPayoutRequests({ limit: 20, page: 1 });

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].status, "Zatraženo", "should be run through the admin mapper, not returned raw");
      assert.equal(result.total, 1);
    });

    it("throws 404 when a specific request can't be found", async (t) => {
      t.mock.method(payoutRepo, "findPayoutRequestById", async () => null);
      await assert.rejects(() => payoutService.getPayoutRequestById(id().toString()), (err) => err.statusCode === 404);
    });

    it("returns the admin-detail mapped shape when found", async (t) => {
      const request = buildPayoutRequest({ adminNote: "napomena" });
      t.mock.method(payoutRepo, "findPayoutRequestById", async () => request);

      const result = await payoutService.getPayoutRequestById(request._id.toString());

      assert.equal(result.id, request._id.toString());
      assert.equal(result.napomena, "napomena");
    });
  });

  describe("listPayoutRequestsForEarner - the earner's own view", () => {
    it("returns a minimal shape including adminNote, distinct from the admin-list shape", async (t) => {
      const request = buildPayoutRequest({ status: "rejected", adminNote: "Nedovoljno sredstava", rejectedAt: new Date() });
      t.mock.method(payoutRepo, "findPayoutRequests", async () => ({ data: [request], total: 1, page: 1, totalPages: 1 }));

      const result = await payoutService.listPayoutRequestsForEarner({ employee: id().toString() });

      assert.equal(result.data.length, 1);
      const item = result.data[0];
      assert.equal(item.id, request._id.toString());
      assert.equal(item.amount, request.amount);
      assert.equal(item.status, "rejected", "raw status, not translated - unlike the admin mapper's shape");
      assert.equal(item.adminNote, "Nedovoljno sredstava");
      assert.ok(item.rejectedAt);
      assert.equal(item.approvedAt, null);
      assert.equal(item.paidAt, null);
    });

    it("passes employee/partner/status filters straight through to the repository", async (t) => {
      const findMock = t.mock.method(payoutRepo, "findPayoutRequests", async () => ({ data: [], total: 0, page: 1, totalPages: 0 }));
      const partnerId = id();

      await payoutService.listPayoutRequestsForEarner({ partner: partnerId.toString(), status: "paid", limit: 5, page: 2 });

      const arg = findMock.mock.calls[0].arguments[0];
      assert.deepEqual(arg.filters, { employee: null, partner: partnerId.toString(), status: "paid" });
      assert.equal(arg.limit, 5);
      assert.equal(arg.page, 2);
    });
  });
});