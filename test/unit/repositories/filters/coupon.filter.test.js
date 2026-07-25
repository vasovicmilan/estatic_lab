import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCouponFilter } from "../../../../src/repositories/filters/coupon.filter.js";
import { id } from "../../../helpers/factories.js";

describe("coupon.filter (buildCouponFilter)", () => {
  it("returns an empty filter when nothing is provided", () => {
    assert.deepEqual(buildCouponFilter(), {});
  });

  it("search matches the code case-insensitively", () => {
    const filter = buildCouponFilter({ search: "leto" });
    assert.deepEqual(filter.code, { $regex: "leto", $options: "i" });
  });

  it("filters by isActive:true", () => {
    assert.equal(buildCouponFilter({ isActive: true }).isActive, true);
  });

  it("filters by isActive:false - not treated the same as omitted", () => {
    assert.equal(buildCouponFilter({ isActive: false }).isActive, false);
  });

  it("ignores isActive when null or undefined", () => {
    assert.equal("isActive" in buildCouponFilter({ isActive: null }), false);
    assert.equal("isActive" in buildCouponFilter({ isActive: undefined }), false);
  });

  it("filters by applicableServices via the service param", () => {
    const serviceId = id();
    assert.equal(buildCouponFilter({ service: serviceId }).applicableServices, serviceId);
  });

  it("filters by applicablePackages via the package param (renamed to packageId internally)", () => {
    const packageId = id();
    assert.equal(buildCouponFilter({ package: packageId }).applicablePackages, packageId);
  });

  it("filters by partner", () => {
    const partnerId = id();
    assert.equal(buildCouponFilter({ partner: partnerId }).partner, partnerId);
  });

  describe("validNow", () => {
    it("forces isActive:true and adds a validFrom/validUntil window around now", () => {
      const before = new Date();
      const filter = buildCouponFilter({ validNow: true, isActive: false });
      const after = new Date();

      assert.equal(filter.isActive, true, "validNow overrides an explicit isActive:false");
      assert.ok(filter.validFrom.$lte >= before && filter.validFrom.$lte <= after);
      assert.ok(filter.validUntil.$gte >= before && filter.validUntil.$gte <= after);
    });

    it("is omitted entirely when validNow is false (the default)", () => {
      const filter = buildCouponFilter({});
      assert.equal("validFrom" in filter, false);
      assert.equal("validUntil" in filter, false);
    });
  });

  it("combines multiple filters at once", () => {
    const serviceId = id();
    const filter = buildCouponFilter({ search: "leto", isActive: true, service: serviceId });
    assert.deepEqual(filter, {
      code: { $regex: "leto", $options: "i" },
      isActive: true,
      applicableServices: serviceId,
    });
  });
});