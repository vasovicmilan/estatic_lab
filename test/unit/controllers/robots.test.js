import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRobotsTxt } from "../../../src/controllers/web/seo.controller.js";

describe("buildRobotsTxt", () => {
  it("blocks the booking flow only when the booking module is enabled", () => {
    assert.match(buildRobotsTxt("https://x.rs", { booking: true }), /Disallow: \/zakazivanje/);
    assert.doesNotMatch(buildRobotsTxt("https://x.rs", { booking: false }), /zakazivanje/);
  });
  it("blocks the video tutorials (/uputstva) from crawling", () => {
    assert.match(buildRobotsTxt("https://x.rs", { booking: false }), /Disallow: \/uputstva/);
  });
  it("always blocks admin/account and lists the sitemap", () => {
    const out = buildRobotsTxt("https://x.rs", { booking: false });
    assert.match(out, /Disallow: \/admin/);
    assert.match(out, /Sitemap: https:\/\/x\.rs\/sitemap\.xml/);
  });
});
