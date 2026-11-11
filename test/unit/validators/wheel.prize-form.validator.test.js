import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validatePrizeCreate } from "../../../src/middlewares/validators/wheel.validator.js";
import { prepareWheelPrizeFormData } from "../../../src/presenters/admin/marketing/wheel-prize.presenter.js";

async function run(body) {
  const req = { body, headers: {}, query: {}, params: {} };
  for (const mw of validatePrizeCreate) {
    if (typeof mw.run === "function") await mw.run(req);
    else await new Promise((res) => mw(req, {}, res));
  }
  return req;
}
const ok = { label: "ESMA", shortLabel: "ESMA", discountType: "percentage", discountValue: "100", weight: "5", stock: "", validDays: "30" };

describe("prize form validator", () => {
  it("accepts a valid form and normalizes it", async () => {
    const req = await run({ ...ok, serviceSlugs: "", isActive: ["0", "1"], isFallback: "0", includeProducts: "0" });
    assert.equal(req.validationErrors, undefined);
    assert.deepEqual(req.body.serviceSlugs, []);
    assert.equal(req.body.isActive, true);
    assert.equal(req.body.isFallback, false);
    assert.equal(req.body.discountValue, 100);
  });
  it("collects errors", async () => {
    const req = await run({ ...ok, label: "", discountValue: "0", color: "zzz", shortLabel: "x".repeat(20) });
    assert.ok(req.validationErrors.label && req.validationErrors.discountValue && req.validationErrors.color && req.validationErrors.shortLabel);
  });
  it("keeps one service slug string as array", async () => {
    const req = await run({ ...ok, serviceSlugs: "teslatone-24" });
    assert.deepEqual(req.body.serviceSlugs, ["teslatone-24"]);
  });
});

describe("prize form presenter", () => {
  it("has cancelUrl, formAction and service options", () => {
    const add = prepareWheelPrizeFormData(null, { serviceOptions: [{ value: "a", label: "A" }] });
    assert.equal(add.cancelUrl, "/admin/tocak/nagrade");
    assert.equal(add.formAction, "/admin/tocak/nagrade");
    assert.equal(add.isEdit, false);
    assert.deepEqual(add.fields.find((f) => f.name === "serviceSlugs").options, [{ value: "a", label: "A" }]);
    const edit = prepareWheelPrizeFormData({ id: "x1", label: "L", shortLabel: "S", awardedCount: 2, isFallback: true, stock: null, serviceSlugs: [] });
    assert.equal(edit.formAction, "/admin/tocak/nagrade/x1");
    assert.equal(edit.isEdit, true);
    assert.equal(edit.fields.find((f) => f.name === "stock").disabled, true);
  });
});
