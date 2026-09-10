import { describe, it } from "node:test";
import assert from "node:assert/strict";
import commissionRepo from "../../../src/repositories/commission-entry.repository.js";
import appointmentService from "../../../src/services/appointment.service.js";
import orderService from "../../../src/services/order.service.js";
import packagePurchaseService from "../../../src/services/package-purchase.service.js";
import runtimeSettingsCache from "../../../src/config/runtime-settings.cache.js";
import commissionService from "../../../src/services/commission.service.js";
import { buildAppointment, buildEmployee, buildOrder, buildPackagePurchase, buildPartner, buildCoupon, id } from "../../helpers/factories.js";

describe("commission.service", () => {
  describe("recordAppointmentCommissions", () => {
    // BUG FIX regression test - see this function's own comment in
    // commission.service.js. transitionStatus's move into "completed" isn't an
    // atomic conditional update, so two racing "complete" requests for the same
    // appointment could both emit the event this function is called from - with
    // no guard, that used to silently create a duplicate commission entry
    // (double real money owed to an employee and/or partner).
    it("skips creating any entry when a commission for this appointment already exists", async (t) => {
      const employee = buildEmployee({ payType: "commission", commissionRate: 20 });
      const appointment = buildAppointment({ employee, finalPrice: 4000, packagePurchase: null, coupon: null });
      const countMock = t.mock.method(commissionRepo, "countCommissionEntries", async () => 1);
      const getMock = t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      assert.equal(countMock.mock.calls.length, 1);
      assert.deepEqual(countMock.mock.calls[0].arguments[0], { sourceType: "appointment", appointment: appointment._id.toString() });
      // the guard must short-circuit before even fetching the appointment - no
      // point doing the rest of the work once we know this is a duplicate call
      assert.equal(getMock.mock.calls.length, 0);
      assert.equal(createMock.mock.calls.length, 0);
    });

    it("does nothing when the appointment can't be found", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => null);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(id().toString());

      assert.equal(createMock.mock.calls.length, 0);
    });

    it("records an employee entry at the employee's own commissionRate when payType is 'commission'", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      const employee = buildEmployee({ payType: "commission", commissionRate: 20 });
      const appointment = buildAppointment({ employee, finalPrice: 4000, packagePurchase: null, coupon: null });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      assert.equal(createMock.mock.calls.length, 1);
      const entry = createMock.mock.calls[0].arguments[0];
      assert.equal(entry.earnerType, "employee");
      assert.equal(entry.baseValue, 4000);
      assert.equal(entry.rate, 20);
      assert.equal(entry.amount, 800);
      assert.equal(entry.status, "earned");
    });

    it("skips the employee entry when payType is not 'commission' (e.g. salaried)", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      const employee = buildEmployee({ payType: "salary", commissionRate: 20 });
      const appointment = buildAppointment({ employee, finalPrice: 4000, packagePurchase: null, coupon: null });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      assert.equal(createMock.mock.calls.length, 0);
    });

    it("skips the employee entry when commissionRate is 0/falsy even if payType is 'commission'", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      const employee = buildEmployee({ payType: "commission", commissionRate: 0 });
      const appointment = buildAppointment({ employee, finalPrice: 4000, packagePurchase: null, coupon: null });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      assert.equal(createMock.mock.calls.length, 0);
    });

    it("pro-rates the employee's base value against the package's TRUE a la carte total, not against originalPrice (which is already the discounted bundle price)", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      // floor set to 0 here - this test is specifically about the pro-rating
      // MATH, not the minimum-floor guarantee (see its own regression tests
      // further down) - a nonzero default floor would mask the exact
      // computed value this test needs to assert on
      t.mock.method(runtimeSettingsCache, "getCommissionPolicy", () => ({ minimumSessionCommission: 0 }));
      const employee = buildEmployee({ payType: "commission", commissionRate: 10 });
      const serviceId = id();
      const servicePackageId = id();
      // Realistic shape: a 5-session package where each session is normally
      // 3000 a la carte (true total 15000), sold as a bundle for 12000 with NO
      // coupon at all - originalPrice equals pricePaid here exactly like
      // package-purchase.service.js's createPurchaseForUser actually produces
      // it (originalPrice defaults to the package's own totalPrice, which is
      // already the discounted bundle price - see Package.basePrice vs
      // Package.totalPrice in the seed data for real examples of this gap).
      const packagePurchase = buildPackagePurchase({
        serviceId,
        servicePackageId,
        originalPrice: 12000,
        pricePaid: 12000, // no coupon - this is the REGRESSION case that exposed the bug
        items: [{ service: serviceId, servicePackageId, unitPrice: 3000, sessionsTotal: 5, sessionsUsed: 1, sessionsReserved: 0 }],
      });
      const appointment = buildAppointment({
        employee,
        finalPrice: 0,
        packagePurchase,
        service: serviceId,
        variant: { servicePackageId },
        coupon: null,
      });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      assert.equal(createMock.mock.calls.length, 1);
      const entry = createMock.mock.calls[0].arguments[0];
      // REGRESSION: unitPrice 3000 * (12000 paid / 15000 true a la carte total) = 2400.
      // The old buggy formula compared pricePaid against originalPrice (both 12000,
      // since no coupon was used) giving a ratio of 1.0 - paying commission on the
      // full undiscounted 3000 and silently ignoring the package's own 20% bundle
      // discount on every package sold without a coupon.
      assert.equal(entry.baseValue, 2400);
      assert.equal(entry.amount, 240);
    });

    it("compounds a coupon's discount on top of the package's own bundle discount correctly", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      t.mock.method(runtimeSettingsCache, "getCommissionPolicy", () => ({ minimumSessionCommission: 0 }));
      const employee = buildEmployee({ payType: "commission", commissionRate: 10 });
      const serviceId = id();
      const servicePackageId = id();
      // Same 15000 true a la carte total (5 sessions x 3000), bundle price
      // 12000 (20% package discount), PLUS a 10% referral coupon on top:
      // pricePaid = 12000 * 0.9 = 10800. Combined discount off the true a la
      // carte value: 10800/15000 = 0.72 (not just the coupon's 0.9, and not
      // just the bundle's 0.8 - both stack, exactly matching what the
      // customer actually paid relative to the real value of what they got).
      const packagePurchase = buildPackagePurchase({
        serviceId,
        servicePackageId,
        originalPrice: 12000,
        pricePaid: 10800,
        discountApplied: 1200,
        items: [{ service: serviceId, servicePackageId, unitPrice: 3000, sessionsTotal: 5, sessionsUsed: 1, sessionsReserved: 0 }],
      });
      const appointment = buildAppointment({
        employee,
        finalPrice: 0,
        packagePurchase,
        service: serviceId,
        variant: { servicePackageId },
        coupon: null,
      });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      const entry = createMock.mock.calls[0].arguments[0];
      // 3000 * 0.72 = 2160
      assert.equal(entry.baseValue, 2160);
      assert.equal(entry.amount, 216);
    });

    it("computes the discount ratio against the whole package's true a la carte total, correctly weighting a package that bundles two different-priced services", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      const employee = buildEmployee({ payType: "commission", commissionRate: 10 });
      const serviceId = id();
      const servicePackageId = id();
      const otherServiceId = id();
      const otherServicePackageId = id();
      // A la carte total: (3000*3) + (5000*2) = 19000. Bundle sold for 16000
      // (~84.2% of true value) with no coupon.
      const packagePurchase = buildPackagePurchase({
        originalPrice: 16000,
        pricePaid: 16000,
        items: [
          { service: serviceId, servicePackageId, unitPrice: 3000, sessionsTotal: 3, sessionsUsed: 0, sessionsReserved: 0 },
          { service: otherServiceId, servicePackageId: otherServicePackageId, unitPrice: 5000, sessionsTotal: 2, sessionsUsed: 0, sessionsReserved: 0 },
        ],
      });
      const appointment = buildAppointment({
        employee,
        finalPrice: 0,
        packagePurchase,
        service: otherServiceId,
        variant: { servicePackageId: otherServicePackageId },
        coupon: null,
      });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      const entry = createMock.mock.calls[0].arguments[0];
      // 5000 * (16000/19000) = 4210.526... -> round2 -> 4210.53
      assert.equal(entry.baseValue, 4210.53);
    });

    it("skips the employee entry entirely when no matching package item can be found (pro-rated value is 0)", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      const employee = buildEmployee({ payType: "commission", commissionRate: 10 });
      const packagePurchase = buildPackagePurchase({ items: [] }); // nothing matches this appointment's service/variant
      const appointment = buildAppointment({ employee, finalPrice: 0, packagePurchase, coupon: null });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      assert.equal(createMock.mock.calls.length, 0);
    });

    it("records a partner entry at the partner's commissionRateServices (NOT commissionRateProducts) for an appointment", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      const partner = buildPartner({ commissionRateServices: 15, commissionRateProducts: 3 });
      const coupon = buildCoupon({ partner });
      const appointment = buildAppointment({ employee: null, finalPrice: 4000, packagePurchase: null, coupon });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      assert.equal(createMock.mock.calls.length, 1);
      const entry = createMock.mock.calls[0].arguments[0];
      assert.equal(entry.earnerType, "partner");
      assert.equal(entry.rate, 15, "must use the services rate, not the products rate, for an appointment-sourced commission");
      assert.equal(entry.amount, 600);
    });

    it("caps the partner's appointment commission at maxCommissionAmountServices when the raw amount would exceed it", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      const partner = buildPartner({ commissionRateServices: 50, maxCommissionAmountServices: 500 });
      const coupon = buildCoupon({ partner });
      // 50% of 4000 would be 2000, but the cap limits it to 500
      const appointment = buildAppointment({ employee: null, finalPrice: 4000, packagePurchase: null, coupon });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      const entry = createMock.mock.calls[0].arguments[0];
      assert.equal(entry.amount, 500);
    });

    it("does not cap the partner's commission when maxCommissionAmountServices is null", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      const partner = buildPartner({ commissionRateServices: 50, maxCommissionAmountServices: null });
      const coupon = buildCoupon({ partner });
      const appointment = buildAppointment({ employee: null, finalPrice: 4000, packagePurchase: null, coupon });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      assert.equal(createMock.mock.calls[0].arguments[0].amount, 2000);
    });

    it("skips the partner entry when the coupon has no partner attached (a plain discount code)", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      const coupon = buildCoupon({ partner: null });
      const appointment = buildAppointment({ employee: null, finalPrice: 4000, packagePurchase: null, coupon });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      assert.equal(createMock.mock.calls.length, 0);
    });

    it("records both an employee entry and a partner entry when both apply to the same appointment", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      const employee = buildEmployee({ payType: "commission", commissionRate: 20 });
      const partner = buildPartner({ commissionRateServices: 15 });
      const coupon = buildCoupon({ partner });
      const appointment = buildAppointment({ employee, finalPrice: 4000, packagePurchase: null, coupon });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      assert.equal(createMock.mock.calls.length, 2);
      const earnerTypes = createMock.mock.calls.map((c) => c.arguments[0].earnerType).sort();
      assert.deepEqual(earnerTypes, ["employee", "partner"]);
    });
  });

  // BUG FIX (business decision, confirmed with the client): a
  // package-covered appointment's pro-rated commission used to round down to
  // 0 - and skip creating an entry entirely - whenever the package was sold
  // at a steep promotional discount or given away for free. The employee
  // performed the same real work regardless of what the package sold for.
  describe("recordAppointmentCommissions - minimum commission floor (package-covered only)", () => {
    it("floors the commission up to the configured minimum for a fully free (pricePaid: 0) package", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      t.mock.method(runtimeSettingsCache, "getCommissionPolicy", () => ({ minimumSessionCommission: 500 }));
      const employee = buildEmployee({ payType: "commission", commissionRate: 20 });
      const serviceId = id();
      const servicePackageId = id();
      const packagePurchase = buildPackagePurchase({
        serviceId,
        servicePackageId,
        pricePaid: 0, // given away as a reward - this is the exact scenario reported
        items: [{ service: serviceId, servicePackageId, unitPrice: 3000, sessionsTotal: 5, sessionsUsed: 1, sessionsReserved: 0 }],
      });
      const appointment = buildAppointment({ employee, finalPrice: 0, packagePurchase, service: serviceId, variant: { servicePackageId }, coupon: null });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      assert.equal(createMock.mock.calls.length, 1, "an entry must now be created even though the raw computed amount is 0");
      const entry = createMock.mock.calls[0].arguments[0];
      assert.equal(entry.baseValue, 0, "baseValue stays the true (zero) pro-rated value - the floor only affects the payout amount");
      assert.equal(entry.amount, 500, "amount is floored up to the configured minimum");
    });

    it("floors up a steep-but-not-quite-free discount too, not just an exact 0", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      t.mock.method(runtimeSettingsCache, "getCommissionPolicy", () => ({ minimumSessionCommission: 500 }));
      const employee = buildEmployee({ payType: "commission", commissionRate: 10 });
      const serviceId = id();
      const servicePackageId = id();
      // unitPrice 3000 * (300 paid / 15000 true total) = 60 base -> 6 RSD raw commission, far under the floor
      const packagePurchase = buildPackagePurchase({
        serviceId,
        servicePackageId,
        pricePaid: 300,
        items: [{ service: serviceId, servicePackageId, unitPrice: 3000, sessionsTotal: 5, sessionsUsed: 1, sessionsReserved: 0 }],
      });
      const appointment = buildAppointment({ employee, finalPrice: 0, packagePurchase, service: serviceId, variant: { servicePackageId }, coupon: null });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      assert.equal(createMock.mock.calls[0].arguments[0].amount, 500);
    });

    it("does NOT apply the floor when the pro-rated commission is already above it", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      t.mock.method(runtimeSettingsCache, "getCommissionPolicy", () => ({ minimumSessionCommission: 500 }));
      const employee = buildEmployee({ payType: "commission", commissionRate: 20 });
      const serviceId = id();
      const servicePackageId = id();
      // unitPrice 3000 * (12000 paid / 15000 true total) = 2400 base -> 480 raw... still under 500, bump to a bigger example
      const packagePurchase = buildPackagePurchase({
        serviceId,
        servicePackageId,
        pricePaid: 15000, // no discount at all
        items: [{ service: serviceId, servicePackageId, unitPrice: 3000, sessionsTotal: 5, sessionsUsed: 1, sessionsReserved: 0 }],
      });
      const appointment = buildAppointment({ employee, finalPrice: 0, packagePurchase, service: serviceId, variant: { servicePackageId }, coupon: null });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      // baseValue 3000 * 20% = 600 - genuinely above the 500 floor, so the
      // real computed value is what gets paid, not the floor
      assert.equal(createMock.mock.calls[0].arguments[0].amount, 600);
    });

    it("never applies the floor to an ordinary a-la-carte (non-package) appointment, no matter how small the commission", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      t.mock.method(runtimeSettingsCache, "getCommissionPolicy", () => ({ minimumSessionCommission: 500 }));
      const employee = buildEmployee({ payType: "commission", commissionRate: 5 });
      // finalPrice 1000 * 5% = 50 - well under the 500 floor, but this is a
      // plain a-la-carte appointment, not a package - the floor must not apply
      const appointment = buildAppointment({ employee, finalPrice: 1000, packagePurchase: null, coupon: null });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      assert.equal(createMock.mock.calls[0].arguments[0].amount, 50, "a-la-carte commission math is untouched by the package-only floor");
    });

    it("applies the floor to a manually-created appointment with a price override (walk-in gift/nagrada), even with no package involved", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      t.mock.method(runtimeSettingsCache, "getCommissionPolicy", () => ({ minimumSessionCommission: 500 }));
      const employee = buildEmployee({ payType: "commission", commissionRate: 20 });
      // manualBooking: true mirrors bookAppointment's own `manualBooking: priceOverride != null` -
      // a gifted walk-in appointment priced at 0 by an admin, not tied to any package
      const appointment = buildAppointment({ employee, finalPrice: 0, packagePurchase: null, manualBooking: true, coupon: null });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      assert.equal(createMock.mock.calls[0].arguments[0].amount, 500);
    });

    it("does NOT apply the floor to a manual appointment with no price override (normal-price walk-in booked on someone's behalf)", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      t.mock.method(runtimeSettingsCache, "getCommissionPolicy", () => ({ minimumSessionCommission: 500 }));
      const employee = buildEmployee({ payType: "commission", commissionRate: 5 });
      // manualBooking stays false here (no priceOverride was used) - this is just an
      // ordinary-priced walk-in an admin booked for the customer, not a gift
      const appointment = buildAppointment({ employee, finalPrice: 1000, packagePurchase: null, manualBooking: false, coupon: null });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      assert.equal(createMock.mock.calls[0].arguments[0].amount, 50, "no override means no floor, regardless of how the appointment was created");
    });

    it("reads the floor from the admin-configurable runtime setting, not a hardcoded value", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      const policyMock = t.mock.method(runtimeSettingsCache, "getCommissionPolicy", () => ({ minimumSessionCommission: 1200 }));
      const employee = buildEmployee({ payType: "commission", commissionRate: 10 });
      const serviceId = id();
      const servicePackageId = id();
      const packagePurchase = buildPackagePurchase({
        serviceId,
        servicePackageId,
        pricePaid: 0,
        items: [{ service: serviceId, servicePackageId, unitPrice: 3000, sessionsTotal: 5, sessionsUsed: 1, sessionsReserved: 0 }],
      });
      const appointment = buildAppointment({ employee, finalPrice: 0, packagePurchase, service: serviceId, variant: { servicePackageId }, coupon: null });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      assert.equal(policyMock.mock.calls.length, 1);
      assert.equal(createMock.mock.calls[0].arguments[0].amount, 1200, "must use whatever the admin-configured value is, not a hardcoded 500");
    });

    it("still creates no entry when the package has no matching item at all (null, not 0) - a data mismatch, not a pricing question the floor should paper over", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      t.mock.method(runtimeSettingsCache, "getCommissionPolicy", () => ({ minimumSessionCommission: 500 }));
      const employee = buildEmployee({ payType: "commission", commissionRate: 10 });
      const packagePurchase = buildPackagePurchase({ items: [{ service: id(), servicePackageId: id(), unitPrice: 3000, sessionsTotal: 5, sessionsUsed: 1, sessionsReserved: 0 }] });
      // appointment's own service/variant deliberately don't match anything in packagePurchase.items
      const appointment = buildAppointment({ employee, finalPrice: 0, packagePurchase, service: id(), variant: { servicePackageId: id() }, coupon: null });
      t.mock.method(appointmentService, "getAppointmentForCommission", async () => appointment);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordAppointmentCommissions(appointment._id.toString());

      assert.equal(createMock.mock.calls.length, 0, "no entry at all - not even a floored one - when nothing in the package actually matches this appointment");
    });
  });

  describe("recordOrderCommission", () => {
    it("does nothing when the order can't be found", async (t) => {
      t.mock.method(orderService, "getOrderForCommission", async () => null);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordOrderCommission(id().toString());

      assert.equal(createMock.mock.calls.length, 0);
    });

    it("does nothing when the order's coupon has no partner attached", async (t) => {
      const order = buildOrder({ coupon: buildCoupon({ partner: null }), totalPrice: 5000 });
      t.mock.method(orderService, "getOrderForCommission", async () => order);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordOrderCommission(order._id.toString());

      assert.equal(createMock.mock.calls.length, 0);
    });

    it("does nothing when totalPrice is 0 or negative", async (t) => {
      const partner = buildPartner();
      const order = buildOrder({ coupon: buildCoupon({ partner }), totalPrice: 0 });
      t.mock.method(orderService, "getOrderForCommission", async () => order);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordOrderCommission(order._id.toString());

      assert.equal(createMock.mock.calls.length, 0);
    });

    it("records a 'pending' entry at commissionRateProducts (NOT commissionRateServices) - this is the exact expensive-device scenario the split was built for", async (t) => {
      const partner = buildPartner({ commissionRateServices: 15, commissionRateProducts: 2, maxCommissionAmountProducts: 3000 });
      const order = buildOrder({ coupon: buildCoupon({ partner }), totalPrice: 200000 }); // e.g. a device order
      t.mock.method(orderService, "getOrderForCommission", async () => order);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordOrderCommission(order._id.toString());

      assert.equal(createMock.mock.calls.length, 1);
      const entry = createMock.mock.calls[0].arguments[0];
      assert.equal(entry.earnerType, "partner");
      assert.equal(entry.sourceType, "order");
      assert.equal(entry.rate, 2, "must use the products rate, not the (much higher) services rate, for an order-sourced commission");
      // 2% of 200000 = 4000, but capped at maxCommissionAmountProducts (3000) -
      // exactly the guardrail a high-ticket device sale needs
      assert.equal(entry.amount, 3000);
      assert.equal(entry.status, "pending", "order commissions start pending, not earned - see processGracePeriodCommissions");
    });
  });

  describe("recordPackagePurchaseCommission", () => {
    // BUG FIX regression test - same reasoning as recordAppointmentCommissions'
    // own regression test above: package_purchase:created has no atomic guard
    // against firing twice for the same purchase.
    it("skips creating an entry when a commission for this purchase already exists", async (t) => {
      const partner = buildPartner({ commissionRateServices: 10 });
      const purchase = buildPackagePurchase({ coupon: buildCoupon({ partner }), pricePaid: 15000 });
      const countMock = t.mock.method(commissionRepo, "countCommissionEntries", async () => 1);
      const getMock = t.mock.method(packagePurchaseService, "getPurchaseForCommission", async () => purchase);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordPackagePurchaseCommission(purchase._id.toString());

      assert.equal(countMock.mock.calls.length, 1);
      assert.deepEqual(countMock.mock.calls[0].arguments[0], { sourceType: "package_purchase", packagePurchase: purchase._id.toString() });
      assert.equal(getMock.mock.calls.length, 0);
      assert.equal(createMock.mock.calls.length, 0);
    });

    it("does nothing when the purchase can't be found", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      t.mock.method(packagePurchaseService, "getPurchaseForCommission", async () => null);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordPackagePurchaseCommission(id().toString());

      assert.equal(createMock.mock.calls.length, 0);
    });

    it("does nothing when the purchase's coupon has no partner attached", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      const purchase = buildPackagePurchase({ coupon: buildCoupon({ partner: null }), pricePaid: 8000 });
      t.mock.method(packagePurchaseService, "getPurchaseForCommission", async () => purchase);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordPackagePurchaseCommission(purchase._id.toString());

      assert.equal(createMock.mock.calls.length, 0);
    });

    it("does nothing when pricePaid is 0 or negative", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      const partner = buildPartner();
      const purchase = buildPackagePurchase({ coupon: buildCoupon({ partner }), pricePaid: 0 });
      t.mock.method(packagePurchaseService, "getPurchaseForCommission", async () => purchase);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordPackagePurchaseCommission(purchase._id.toString());

      assert.equal(createMock.mock.calls.length, 0);
    });

    it("records an 'earned' entry at commissionRateServices (packages are a services-side commission, not products)", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      const partner = buildPartner({ commissionRateServices: 12, commissionRateProducts: 4 });
      const purchase = buildPackagePurchase({ coupon: buildCoupon({ partner }), pricePaid: 9000 });
      t.mock.method(packagePurchaseService, "getPurchaseForCommission", async () => purchase);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordPackagePurchaseCommission(purchase._id.toString());

      assert.equal(createMock.mock.calls.length, 1);
      const entry = createMock.mock.calls[0].arguments[0];
      assert.equal(entry.sourceType, "package_purchase");
      assert.equal(entry.rate, 12);
      assert.equal(entry.amount, 1080);
      assert.equal(entry.status, "earned");
    });

    it("caps at maxCommissionAmountServices when set", async (t) => {
      t.mock.method(commissionRepo, "countCommissionEntries", async () => 0);
      const partner = buildPartner({ commissionRateServices: 50, maxCommissionAmountServices: 1000 });
      const purchase = buildPackagePurchase({ coupon: buildCoupon({ partner }), pricePaid: 9000 });
      t.mock.method(packagePurchaseService, "getPurchaseForCommission", async () => purchase);
      const createMock = t.mock.method(commissionRepo, "createCommissionEntry", async () => ({}));

      await commissionService.recordPackagePurchaseCommission(purchase._id.toString());

      assert.equal(createMock.mock.calls[0].arguments[0].amount, 1000);
    });
  });

  describe("reversePackagePurchaseCommission", () => {
    it("does nothing when there is no earned entry to reverse", async (t) => {
      t.mock.method(commissionRepo, "findEarnedCommissionByPackagePurchase", async () => null);
      const updateMock = t.mock.method(commissionRepo, "updateCommissionEntryById", async () => ({}));

      await commissionService.reversePackagePurchaseCommission(id().toString());

      assert.equal(updateMock.mock.calls.length, 0);
    });

    it("marks the found entry as reversed with the given reason", async (t) => {
      const entry = { _id: id() };
      t.mock.method(commissionRepo, "findEarnedCommissionByPackagePurchase", async () => entry);
      const updateMock = t.mock.method(commissionRepo, "updateCommissionEntryById", async () => ({}));

      await commissionService.reversePackagePurchaseCommission(id().toString(), "Kupac je otkazao paket");

      assert.equal(updateMock.mock.calls.length, 1);
      const [entryId, changes] = updateMock.mock.calls[0].arguments;
      assert.equal(entryId, entry._id);
      assert.equal(changes.status, "reversed");
      assert.equal(changes.reversalReason, "Kupac je otkazao paket");
      assert.ok(changes.reversedAt instanceof Date);
    });
  });

  describe("promoteOrderCommissionOnCompletion", () => {
    it("does nothing when there is no pending entry for the order", async (t) => {
      t.mock.method(commissionRepo, "findPendingCommissionByOrder", async () => null);
      const updateMock = t.mock.method(commissionRepo, "updateCommissionEntryById", async () => ({}));

      await commissionService.promoteOrderCommissionOnCompletion(id().toString());

      assert.equal(updateMock.mock.calls.length, 0);
    });

    it("promotes the found pending entry straight to earned", async (t) => {
      const entry = { _id: id() };
      t.mock.method(commissionRepo, "findPendingCommissionByOrder", async () => entry);
      const updateMock = t.mock.method(commissionRepo, "updateCommissionEntryById", async () => ({}));

      await commissionService.promoteOrderCommissionOnCompletion(id().toString());

      const [entryId, changes] = updateMock.mock.calls[0].arguments;
      assert.equal(entryId, entry._id);
      assert.equal(changes.status, "earned");
      assert.ok(changes.earnedAt instanceof Date);
    });
  });

  describe("processGracePeriodCommissions", () => {
    it("reverses an entry whose order no longer exists", async (t) => {
      const entry = { _id: id(), order: null };
      t.mock.method(commissionRepo, "findPendingOrderCommissions", async () => [entry]);
      const updateMock = t.mock.method(commissionRepo, "updateCommissionEntryById", async () => ({}));

      const result = await commissionService.processGracePeriodCommissions();

      assert.equal(updateMock.mock.calls[0].arguments[1].status, "reversed");
      assert.equal(updateMock.mock.calls[0].arguments[1].reversalReason, "Porudžbina više ne postoji");
      assert.deepEqual(result, { total: 1, earned: 0, reversed: 1, stillPending: 0 });
    });

    it("reverses an entry whose order is cancelled/returned/refunded", async (t) => {
      const entry = { _id: id(), order: { status: "cancelled", createdAt: new Date("2000-01-01") } };
      t.mock.method(commissionRepo, "findPendingOrderCommissions", async () => [entry]);
      const updateMock = t.mock.method(commissionRepo, "updateCommissionEntryById", async () => ({}));

      const result = await commissionService.processGracePeriodCommissions();

      assert.equal(updateMock.mock.calls[0].arguments[1].status, "reversed");
      assert.match(updateMock.mock.calls[0].arguments[1].reversalReason, /cancelled/);
      assert.equal(result.reversed, 1);
    });

    it("earns an entry once the order is old enough to be past the grace period", async (t) => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 30); // well past the default 14-day window
      const entry = { _id: id(), order: { status: "pending", createdAt: oldDate } };
      t.mock.method(commissionRepo, "findPendingOrderCommissions", async () => [entry]);
      const updateMock = t.mock.method(commissionRepo, "updateCommissionEntryById", async () => ({}));

      const result = await commissionService.processGracePeriodCommissions();

      assert.equal(updateMock.mock.calls[0].arguments[1].status, "earned");
      assert.equal(result.earned, 1);
    });

    it("leaves a recent, still-valid order's entry untouched (still pending)", async (t) => {
      const entry = { _id: id(), order: { status: "pending", createdAt: new Date() } };
      t.mock.method(commissionRepo, "findPendingOrderCommissions", async () => [entry]);
      const updateMock = t.mock.method(commissionRepo, "updateCommissionEntryById", async () => ({}));

      const result = await commissionService.processGracePeriodCommissions();

      assert.equal(updateMock.mock.calls.length, 0);
      assert.deepEqual(result, { total: 1, earned: 0, reversed: 0, stillPending: 1 });
    });

    it("keeps processing the remaining entries even if one throws", async (t) => {
      const badEntry = { _id: id(), order: { status: "pending", get createdAt() { throw new Error("boom"); } } };
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 30);
      const goodEntry = { _id: id(), order: { status: "pending", createdAt: oldDate } };
      t.mock.method(commissionRepo, "findPendingOrderCommissions", async () => [badEntry, goodEntry]);
      const updateMock = t.mock.method(commissionRepo, "updateCommissionEntryById", async () => ({}));

      const result = await commissionService.processGracePeriodCommissions();

      // only the good entry's update call should have gone through
      assert.equal(updateMock.mock.calls.length, 1);
      assert.equal(result.total, 2);
      assert.equal(result.earned, 1);
    });

    it("returns a zeroed summary when there are no pending entries at all", async (t) => {
      t.mock.method(commissionRepo, "findPendingOrderCommissions", async () => []);
      const updateMock = t.mock.method(commissionRepo, "updateCommissionEntryById", async () => ({}));

      const result = await commissionService.processGracePeriodCommissions();

      assert.equal(updateMock.mock.calls.length, 0);
      assert.deepEqual(result, { total: 0, earned: 0, reversed: 0, stillPending: 0 });
    });
  });

  describe("getEarnedTotal", () => {
    it("delegates straight to the repository's sumEarnedAmount with the given earner filters", async (t) => {
      const sumMock = t.mock.method(commissionRepo, "sumEarnedAmount", async () => 4200);
      const partnerId = id();

      const total = await commissionService.getEarnedTotal({ partner: partnerId });

      assert.equal(total, 4200);
      assert.deepEqual(sumMock.mock.calls[0].arguments[0], { employee: null, partner: partnerId });
    });
  });

  describe("listCommissionsForEarner", () => {
    it("delegates to findCommissionEntries with the filters and pagination bundled together", async (t) => {
      const findMock = t.mock.method(commissionRepo, "findCommissionEntries", async () => ({ data: [], total: 0 }));
      const employeeId = id();

      await commissionService.listCommissionsForEarner({ employee: employeeId, status: "earned", limit: 5, page: 2 });

      const arg = findMock.mock.calls[0].arguments[0];
      assert.deepEqual(arg.filters, { employee: employeeId, partner: null, status: "earned", sourceType: null });
      assert.equal(arg.limit, 5);
      assert.equal(arg.page, 2);
    });
  });
});