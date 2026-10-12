import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSredimeSummary } from "../../../src/services/external-busy-interval.service.js";

describe("parseSredimeSummary", () => {
  it("splits reference and service", () => {
    assert.deepEqual(parseSredimeSummary("SrediMe #V2PPM69 (Relaks / antistres masaža)"), { reference: "V2PPM69", service: "Relaks / antistres masaža" });
  });
  it("handles a missing service part and unknown formats", () => {
    assert.deepEqual(parseSredimeSummary("SrediMe #ABC123"), { reference: "ABC123", service: null });
    assert.deepEqual(parseSredimeSummary("Nešto drugo"), { reference: null, service: "Nešto drugo" });
    assert.deepEqual(parseSredimeSummary(null), { reference: null, service: null });
  });
});
