import { describe, it } from "node:test";
import assert from "node:assert/strict";
import testimonialRepo from "../../../src/repositories/testimonial.repository.js";
import { listTestimonials } from "../../../src/controllers/api/v1/catalog.controller.js";

const PRODUCT_ID = "64b7f0c2a1b2c3d4e5f60718";

function run(query, t, { rows = [], summary = { average: 0, count: 0 } } = {}) {
  const calls = { find: [], summary: [] };
  t.mock.method(testimonialRepo, "findApprovedTestimonials", async (args) => {
    calls.find.push(args);
    return rows;
  });
  t.mock.method(testimonialRepo, "getRatingSummary", async (args) => {
    calls.summary.push(args);
    return summary;
  });

  return new Promise((resolve) => {
    const res = { json: (body) => resolve({ body, calls }) };
    listTestimonials({ query }, res, (error) => resolve({ error, calls }));
  });
}

describe("catalog.controller listTestimonials", () => {
  it("without filters returns the plain list, no meta and no summary query", async (t) => {
    const { body, calls } = await run({}, t);
    assert.equal(body.success, true);
    assert.equal(body.meta, undefined);
    assert.equal(calls.summary.length, 0);
    assert.equal(calls.find[0].product, null);
    assert.equal(calls.find[0].limit, 6);
  });

  it("with ?product= narrows the list to that product and adds a rounded summary over all its reviews", async (t) => {
    const { body, calls } = await run({ product: PRODUCT_ID, limit: "3" }, t, { summary: { average: 4.666, count: 23 } });
    assert.equal(calls.find[0].product, PRODUCT_ID);
    assert.equal(calls.find[0].limit, 3);
    assert.deepEqual(calls.summary[0], { product: PRODUCT_ID, service: null, package: null });
    assert.deepEqual(body.meta, { summary: { average: 4.7, count: 23 } });
  });

  it("clamps limit to 24", async (t) => {
    const { calls } = await run({ limit: "500" }, t);
    assert.equal(calls.find[0].limit, 24);
  });

  it("rejects a malformed id with a 400 instead of letting Mongoose throw a CastError", async (t) => {
    const { error, calls } = await run({ product: "not-an-id" }, t);
    assert.equal(error.statusCode, 400);
    assert.equal(calls.find.length, 0);
  });

  it("rejects an array-valued filter (?product=a&product=b)", async (t) => {
    const { error } = await run({ product: [PRODUCT_ID, PRODUCT_ID] }, t);
    assert.equal(error.statusCode, 400);
  });
});
