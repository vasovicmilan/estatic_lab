import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareExpertListData, prepareExpertDetailData } from "../../../../src/presenters/public/expert.presenter.js";

describe("prepareExpertListData", () => {
  it("passes the expert list through unmodified", () => {
    const experts = [{ id: "e1", imePrezime: "Ana Anic" }];
    const view = prepareExpertListData(experts);

    assert.equal(view.experts, experts);
    assert.equal(view.breadcrumbs.length, 1);
  });
});

describe("prepareExpertDetailData", () => {
  it("points bookingUrl at the general booking flow, not a pre-filtered one", () => {
    const view = prepareExpertDetailData({ imePrezime: "Ana Anic" });
    assert.equal(view.bookingUrl, "/zakazivanje");
  });

  it("uses the expert's name as the last breadcrumb", () => {
    const view = prepareExpertDetailData({ imePrezime: "Marko Markovic" });
    assert.equal(view.breadcrumbs.at(-1).label, "Marko Markovic");
    assert.equal(view.breadcrumbs.at(-1).url, null);
  });
});