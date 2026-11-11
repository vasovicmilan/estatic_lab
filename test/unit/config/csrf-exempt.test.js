import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isCsrfExemptJsonRequest } from "../../../src/config/csrf.config.js";

const req = (url, ct) => ({ originalUrl: url, headers: ct ? { "content-type": ct } : {} });

describe("csrf exemption for the wheel spin", () => {
  it("exempts only JSON posts to /tocak/vrti", () => {
    assert.equal(isCsrfExemptJsonRequest(req("/tocak/vrti", "application/json")), true);
    assert.equal(isCsrfExemptJsonRequest(req("/tocak/vrti?x=1", "application/json; charset=utf-8")), true);
  });
  it("still protects form posts and other routes", () => {
    assert.equal(isCsrfExemptJsonRequest(req("/tocak/vrti", "application/x-www-form-urlencoded")), false);
    assert.equal(isCsrfExemptJsonRequest(req("/tocak/vrti")), false);
    assert.equal(isCsrfExemptJsonRequest(req("/kontakt", "application/json")), false);
    assert.equal(isCsrfExemptJsonRequest(req("/admin/tocak/nagrade", "application/json")), false);
  });
});
